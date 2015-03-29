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

from sys import stdout
from datetime import datetime, timedelta
import ldap
from pyratemp import Template
from wand.image import Image
from jaydebeapi import connect as jdbc_connect
from os import getenv, path
from argh import dispatch_command

def get_user_data(username, ldap_url, ldap_user_base_dn, 
                  ldap_filter_username, portrait_path,
                  blank_portrait_path):
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
    full_name = data['cn'][0]
    if 'jpegPhoto' in data:
        jpeg = data['jpegPhoto'][0]
        jpeg_filename = portrait_path+'/'+username+'.jpg'
        open(jpeg_filename, 'wb').write(crop(jpeg))
    else:
        jpeg_filename = blank_portrait_path
    return dict(full_name=full_name, jpeg_filename=jpeg_filename)

def crop(jpeg, width=134, height=177):
    """Returns a cropped version of an image if it has a non-standard size"""
    img = Image(blob=jpeg)
    if (img.height != height or
        img.width != width):
        img.crop(0, 0, width, height)
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

def get_vertica_data(vertica_conn, template_dir, 
                     start_date, end_date, top_entry_count):
    """Gets analytics data from vertica"""
    def jpype_to_py(col):
        """Convert jpype types to python"""
        if hasattr(col, 'value'):
            return col.value
        else:
            return col 

    # run a vertica query
    def vertica_query(sql):
        """Runs a vertica SQL query and returns a list of dicts"""
        curs = vertica_conn.cursor()
        curs.execute(sql)
        col_names = [t[0] for t in curs.description]
        rows = curs.fetchall()
        return [dict(list(zip(col_names, 
                         [jpype_to_py(col) for col in row]))) for row in rows]

    # load SQL templates
    top_n_sql_tpl = Template(filename=template_dir+"/top_n_sql.tpl")
    done_by_user_sql_tpl = Template(filename=template_dir+"/done_by_user_sql.tpl")
    failed_by_user_sql_tpl = Template(filename=template_dir+"/failed_by_user_sql.tpl")

    top_n_sql = top_n_sql_tpl(start_date=start_date, end_date=end_date, 
                              n=top_entry_count)
    top_n = vertica_query(top_n_sql)
    for row in top_n:
        username = row['user_name']
        failed_by_user_sql = failed_by_user_sql_tpl(start_date=start_date, 
                                                    end_date=end_date, 
                                                    username=username)
        failed = vertica_query(failed_by_user_sql)
        if len(failed) > 0:
            row.update(failed[0])
        else:
            tmp = {
                'failed_core_weeks': 0.0,
                'failed_cpu_time_avg': 0.0,
                'failed_cpu_time_stddev': 0.0,
                'failed_num_jobs': 0,
                'failed_run_time_avg': 0.0            
                }
            row.update(tmp)

        done_by_user_sql = done_by_user_sql_tpl(start_date=start_date, 
                                                end_date=end_date, 
                                                username=username)
        done = vertica_query(done_by_user_sql)
        if len(done) > 0:
            row.update(done[0])
        else:
            tmp = {
                'done_core_weeks': 0.0,
                'done_cpu_time_avg': 0.0,
                'done_cpu_time_stddev': 0.0,
                'done_num_jobs': 0,
                'done_run_time_avg': 0.0
                }
            row.update(tmp)
    return top_n

def render_latex(output_file, latex_template_fn, 
                 start_date, end_date, 
                 top_entry_count, top_n, 
                 user_data):
    """Render the latex template"""
    latex_tpl = Template(filename=latex_template_fn)
    latex = latex_tpl(start_date=start_date, end_date=end_date, 
                      top_n=top_n, n=top_entry_count, 
                      user_data=user_data)
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
         template_dir=path.dirname(path.realpath(__file__))):
    """Generates report from database via JDBC"""
    
    if output == '-':
        output_file = stdout
    else:
        output_file = open(output, 'w')

    vertica_conn = jdbc_connect(jdbc_driver, 
                                [jdbc_url, username, password], 
                                jdbc_classpath)

    top_n = get_vertica_data(vertica_conn, template_dir,
                             start_date, end_date, 
                             top_entry_count)

    user_data = dict()
    users = set([row['user_name'] for row in top_n])
    for username in users:
        user_data[username] = get_user_data(username, ldap_url, 
                                            ldap_user_base_dn, 
                                            ldap_filter_username,
                                            portrait_path,
                                            blank_portrait_path)
        
    render_latex(output_file=output_file,
                 latex_template_fn=template_dir+'/humgen_farmers_standup.tex.tpl', 
                 start_date=start_date, end_date=end_date, 
                 top_entry_count=top_entry_count,
                 top_n=top_n, 
                 user_data=user_data)

    output_file.close()

if __name__ == "__main__":
    dispatch_command(main)
