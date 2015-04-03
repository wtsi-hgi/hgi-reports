#!/usr/bin/env python
################################################################################
# Copyright (c) 2014, 2015 Genome Research Ltd.
#
# Author: Emyr James <ej4@sanger.ac.uk>
# Author: Joshua C. Randall <jcrandall@alum.mit.edu>
#
# This program is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation; either version 3 of the License, or (at your option) any later
# version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
# details.
#
# You should have received a copy of the GNU General Public License along with
# this program. If not, see <http://www.gnu.org/licenses/>.
################################################################################

"""Generate humgen farmers' stand-up report (LaTeX)"""

from __future__ import print_function
from sys import exit, stdout, stderr
from datetime import datetime, timedelta
import ldap
from pyratemp import Template
from wand.image import Image
from wand.color import Color
from wand.font import Font
from hashlib import md5
from jaydebeapi import connect as jdbc_connect
from jaydebeapi import DBAPITypeObject
from os import getenv, path
from argh import dispatch_command

PALETTE = ['#A6761D', '#666666', '#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E', '#E6AB02']

def get_user_data(username, ldap_url, ldap_user_base_dn, 
                  ldap_filter_username, portrait_path,
                  font_path):
    """Get user data from LDAP and stores portrait to disk
    
    Arguments:
    username -- the username for which to get data
    
    Returns: a dict of user data including a path to a cropped photo 
    """
    con = ldap.initialize(ldap_url)
    con.set_option(ldap.OPT_X_TLS_DEMAND, True)
    results = con.search_s(ldap_user_base_dn,
                           ldap.SCOPE_SUBTREE, 
                           ldap_filter_username % username)
    if len(results) != 1:
        return None
    data = results[0][1]
    last_name = data['sn'][0]
    first_name = data['givenName'][0]
    full_name = data['cn'][0]
    if len(full_name) > 25:
        full_name = first_name + " " + last_name
    if len(full_name) > 25:
        full_name = first_name + " " + last_name[0].upper() + "."

    jpeg_filename = portrait_path+'/'+username+'.jpg'
    if 'jpegPhoto' in data:
        jpeg = data['jpegPhoto'][0]
        open(jpeg_filename, 'wb').write(crop(jpeg))
    else:
        caption = username[0].upper()
        font = Font(path=font_path, 
                    size=120, 
                    color=Color('white'))
        color_index = int(md5(username).hexdigest()[0], 16) % len(PALETTE)
        with Image(background=Color(PALETTE[color_index]),
                   width=128, 
                   height=171) as image:
            image.caption(caption, 
                          left=8,
                          top=8, 
                          width=128, 
                          height=171, 
                          font=font,
                          gravity='center')
            image.save(filename=jpeg_filename)
    return dict(full_name=full_name, jpeg_filename=jpeg_filename)

def crop(jpeg, width=128, height=171):
    """Returns a cropped version of an image"""
    img = Image(blob=jpeg)
    img.crop(left=3, top=3, width=width, height=height)
    return img.make_blob()

def today_sql():
    """Returns a SQL date string for today's date"""
    now = datetime.now()
    return '%04d-%02d-%02d' % (now.year, now.month, now.day)
    
def seven_days_ago_sql():
    """Returns a SQL date string for 7 days ago"""
    now = datetime.now()
    week = timedelta(weeks=1)
    now = now - week
    return '%04d-%02d-%02d' % (now.year, now.month, now.day)

def jpype_to_py(col):
    """Convert jpype types to python"""
    if hasattr(col, 'value'):
        return col.value
    else:
        return col 

# run a vertica query
def vertica_query(vertica_conn, sql):
    """Runs a vertica SQL query and returns a list of dicts"""
    curs = vertica_conn.cursor()
    try:
        curs.execute(sql)
    except Exception, e:
        print("Exception running SQL query [%s]: %s" % (sql, e), file=stderr)
        exit(1)
    col_names = [t[0] for t in curs.description]
    rows = curs.fetchall()
    if len(rows) > 0:
        return [dict(list(zip(col_names, 
                              [jpype_to_py(col) for col in row]))) for row in rows]
    else:
        # no results, prepare an empty set
        empty = dict()
        for i, col_name in enumerate(col_names):
            col_type = curs.description[i][1]
            if col_type == 'DECIMAL' or col_type == 'FLOAT':
                empty[col_name] = 0.0
            elif col_type == 'INTEGER':
                empty[col_name] = 0
        return [ empty ]

def get_vertica_top_n(vertica_conn, template_dir, 
                      start_date, end_date, top_entry_count):
    """Gets analytics data from vertica"""
    top_n_users = dict()

    for tpl_type in ["cpu", "mem"]:
        if tpl_type == "cpu":
            order_by = "core_wall_time_weeks"
        else:
            order_by = "mem_req_gb_weeks"
        top_n_sql_tpl = Template(filename=template_dir+"/top_n_"+tpl_type+".sql.tpl")
        top_n_sql = top_n_sql_tpl(project="humgen",
                                  cluster="farm3",
                                  start_date=start_date, 
                                  end_date=end_date, 
                                  order_by_desc=order_by,
                                  limit=top_entry_count)
        top_n = vertica_query(vertica_conn, top_n_sql)
        top_n_users[tpl_type] = [ row['user_name'] for row in top_n ]
    return top_n_users

def get_vertica_user_details(vertica_conn, template_dir, 
                             start_date, end_date, 
                             users):
    user_details = dict()
    for user in users:
        user_details[user] = dict()
        user_details[user]['done'] = {}
        user_details[user]['failed'] = {}

    user_job_details_tpl = Template(filename=template_dir+"/user_job_details.sql.tpl")
    failed_user_job_details_sql = user_job_details_tpl(project="humgen",
                                                       cluster="farm3",
                                                       sql_conds=["job_exit_status = 'EXIT' AND NOT REGEXP_LIKE(job_cmd, '^[[:space:]]*cr[_]')"],
                                                       start_date=start_date, 
                                                       end_date=end_date, 
                                                       usernames=users)
    failed = vertica_query(vertica_conn, failed_user_job_details_sql)
    if len(failed) > 0:
        for row in failed:
            username = row['user_name']
            user_details[username]['failed'] = row
    else:
        print("no results from vertica_query for failed_user_job_details_sql", 
              file=stderr)
        exit(1)

    done_user_job_details_sql = user_job_details_tpl(project="humgen",
                                                     cluster="farm3",
                                                     sql_conds=["job_exit_status = 'DONE' OR REGEXP_LIKE(job_cmd, '^[[:space:]]*cr[_]')"],
                                                     start_date=start_date, 
                                                     end_date=end_date, 
                                                     usernames=users)
    done = vertica_query(vertica_conn, done_user_job_details_sql)
    if len(done) > 0:
        for row in done:
            username = row['user_name']
            user_details[username]['done'] = row
    else:
        print("no results from vertica_query for done_user_job_details_sql", 
              file=stderr)
        exit(1)

    return user_details

def render_latex(output_file, latex_template_fn, 
                 start_date, end_date, 
                 top_entry_count, 
                 top_n_users, 
                 user_data,
                 user_details):
    """Render the latex template"""
    latex_tpl = Template(filename=latex_template_fn)
    latex = latex_tpl(start_date=start_date, end_date=end_date, 
                      n=top_entry_count, 
                      top_n_users=top_n_users, 
                      user_data=user_data,
                      user_details=user_details)
    output_file.write(latex)

def main(output="-", top_entry_count=20, 
         start_date=seven_days_ago_sql(), end_date=today_sql(), 
         username='', password='', 
         jdbc_driver='com.vertica.Driver', 
         jdbc_url='jdbc:vertica://localhost:5433/analytics', 
         jdbc_classpath=getenv('CLASSPATH', '.'),
         ldap_url=getenv('LDAP_URL','ldap://ldap/'),
         ldap_user_base_dn='',
         ldap_filter_username='(uid=%s)',
         portrait_path='reports/portraits',
         blank_portrait_path='reports/portraits/blank.jpg',
         font_path='fonts/LeagueGothic-CondensedRegular.otf',
         template_dir=path.dirname(path.realpath(__file__))):
    """Generates report from database via JDBC"""
    
    if output == '-':
        output_file = stdout
    else:
        output_file = open(output, 'w')

    vertica_conn = jdbc_connect(jdbc_driver, 
                                [jdbc_url, username, password], 
                                jdbc_classpath)

    top_n_users = get_vertica_top_n(vertica_conn, template_dir,
                                    start_date, end_date, 
                                    top_entry_count)
    
    user_data = dict()
    users = set(top_n_users['mem'] + top_n_users['cpu'])
    for username in users:
        user_data[username] = get_user_data(username, ldap_url, 
                                            ldap_user_base_dn, 
                                            ldap_filter_username,
                                            portrait_path,
                                            font_path)

    user_details = get_vertica_user_details(vertica_conn, template_dir,
                                            start_date, end_date,
                                            users)

    render_latex(output_file=output_file,
                 latex_template_fn=template_dir+'/humgen_farmers_standup.tex.tpl', 
                 start_date=start_date, end_date=end_date, 
                 top_entry_count=top_entry_count,
                 top_n_users=top_n_users,
                 user_data=user_data,
                 user_details=user_details)

    output_file.close()

if __name__ == "__main__":
    dispatch_command(main)
