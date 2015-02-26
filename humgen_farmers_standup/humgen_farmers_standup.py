import sys
import datetime
import subprocess
import pyratemp
import ldap

import numpy as np
import matplotlib.pyplot as plot
import wand.image
# generate a weekly farm stats report for farmer's standup
# calls out to java/jdbc program to run some queries
# generates some graphs using matplotlib
# puts the graphs together with some latex templates
# runs latex to create the pdf

# read the blank jpg
blank=open('portraits/blank.jpg','rb').read()

# get info from ldap
def get_user_data(uid) :
	con = ldap.initialize('ldap://nissrv3.internal.sanger.ac.uk/')	
	con.set_option(ldap.OPT_X_TLS_DEMAND, True)
	results=con.search_s('dc=sanger,dc=ac,dc=uk',ldap.SCOPE_SUBTREE,'(uid='+uid+')')
	if len(results) != 1 :
		return None
	data=results[0][1]
	full_name=data['cn'][0]
	if 'jpegPhoto' in data :
		jpeg=data['jpegPhoto'][0]
	else :
		jpeg=blank
	return (full_name,crop(jpeg))

# crop an image if it has the non-standard size
def crop(jpeg) :
	img=wand.image.Image(blob=jpeg)
	if img.height != 177 :
		img.crop(0,0,134,177)
	return img.make_blob()

# get sql style date string for 7 days ago
def seven_days_ago() :
	now=datetime.datetime.now()
	week=datetime.timedelta(weeks=1)
	now=now-week
	return '%04d-%02d-%02d' % (now.year, now.month, now.day)

# top N users by cpu
# removes ones with crazy efficiency
N=20
top_N_sql="""
	select
		user_name as user_name,
		sum(cpu_time)/(60*60*24*7) as core_weeks,
		100.0*min(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as cpu_time_min,
		100.0*max(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as cpu_time_max,
		100.0*sum(cpu_time)/sum(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))) as cpu_time_avg,
        100.0*stddev(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as cpu_time_stddev,
		count(*) as num_jobs,
		avg(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))/3600 as run_time_avg
	from rpt_jobmart_raw as r, isg_work_area_groups as g
	where r.project_name=g.cname
	and pname='humgen'
	and finish_time_gmt >='%s'
	and cluster_name='farm3'
	and finish_time_gmt > start_time_gmt
	and run_time > 0
	and nprocs > 0
	and ncores >0
	and cpu_time/run_time < 1024
	and cpu_time > 0
    and job_exit_status='DONE'
	group by user_name
	order by 2 desc
	limit %s
"""
failed_by_user="""
    select
        user_name as user_name,
        sum(cpu_time)/(60*60*24*7) as failed_core_weeks,
        100.0*min(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as failed_cpu_time_min,
        100.0*max(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as failed_cpu_time_max,
        100.0*sum(cpu_time)/sum(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))) as failed_cpu_time_avg,
        100.0*stddev(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as failed_cpu_time_stddev,
        count(*) as failed_num_jobs,
        avg(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))/3600 as failed_run_time_avg
    from rpt_jobmart_raw as r, isg_work_area_groups as g
    where r.project_name=g.cname
    and pname='humgen'
    and finish_time_gmt >='%s'
    and cluster_name='farm3'
    and finish_time_gmt > start_time_gmt
    and run_time > 0
    and nprocs > 0
    and ncores >0
    and cpu_time/run_time < 1024
    and cpu_time > 0
    and job_exit_status='EXIT'
    and user_name='%s'
    group by user_name
"""

top_N_sql=top_N_sql % (seven_days_ago(),N)
p=subprocess.Popen(['java','-cp','.:vertica.jar','VerticaPython'],shell=False, stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.STDOUT)
topN=eval(p.communicate(input=top_N_sql)[0])
for row in topN :
    uid=row['user_name']
    fname,jpeg=get_user_data(uid)
    row['fname']=fname
    jpeg_filename='portraits/'+uid+'.jpg'
    open(jpeg_filename,'wb').write(jpeg)
    row['jpeg_filename']=jpeg_filename
    failed_by_user_sql=failed_by_user % (seven_days_ago(),uid)
    p=subprocess.Popen(['java','-cp','.:vertica.jar','VerticaPython'],shell=False, stdout=subprocess.PIPE, stdin=subprocess.PIPE, stderr=subprocess.STDOUT)
    failed=eval(p.communicate(input=failed_by_user_sql)[0])
    if len(failed) > 0 :
        row.update(failed[0])
    else :
        tmp={
            'failed_core_weeks' : 0.0,
            'failed_cpu_time_avg' : 0.0,
            'failed_cpu_time_stddev' : 0.0,
            'failed_num_jobs' : 0,
            'failed_run_time_avg' : 0.0            
        }
        row.update(tmp)

# render the latex template
tpl=pyratemp.Template(filename='humgen_farmers_standup_template.tex')
latex=tpl(date=seven_days_ago(), topN=topN, N=N)
print latex
