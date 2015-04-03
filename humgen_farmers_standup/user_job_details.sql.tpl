<!--(macro wall_time)-->
(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))
<!--(end)-->
<!--(macro core_wall_time)-->
(num_slots*(@!wall_time()!@))
<!--(end)-->
<!--(macro mem_req_gb)-->
mem_req/1024
<!--(end)-->
<!--(macro mem_req_gb_s)-->
((@!mem_req_gb()!@)*(@!wall_time()!@))
<!--(end)-->
<!--(macro mem_usage_gb)-->
mem_usage/1024/1024
<!--(end)-->
<!--(macro mem_usage_gb_s)-->
((@!mem_usage_gb()!@)*(@!wall_time()!@))
<!--(end)-->
<!--(macro sql_in_item)-->
'$!item!$'<!--(if i<length-1)-->,<!--(end)-->
<!--(end)-->
<!--(macro sql_in)-->
  (
  <!--(for i, li in enumerate(list))-->
    $!sql_in_item(item=li,i=i,length=len(list))!$
  <!--(end)-->
  )
<!--(end)-->
select
	user_name as user_name,
	sum(@!mem_req_gb_s()!@)/(60*60*24*7) as mem_req_gb_weeks,
	sum(@!mem_usage_gb_s()!@)/(60*60*24*7) as mem_usage_gb_weeks,
	100.0*min(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as mem_eff_min,
	100.0*max(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as mem_eff_max,
	100.0*avg(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as mem_eff_avg,
	100.0*stddev(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@)/sqrt(count(*)) as mem_eff_se,
	100.0*sum(@!mem_usage_gb_s()!@)/sum(@!mem_req_gb_s()!@) as mem_eff_total,
	(sum(@!mem_req_gb_s()!@)-sum(@!mem_usage_gb_s()!@))/(60*60*24*7) as wasted_mem_gb_weeks,
	avg(@!mem_req_gb!@) as mem_req_gb_avg,
	stddev(@!mem_req_gb!@)/sqrt(count(*)) as mem_req_gb_se,
	avg(@!mem_usage_gb!@) as mem_usage_gb_avg,
 	stddev(@!mem_usage_gb!@)/sqrt(count(*)) as mem_usage_gb_se,
	avg(@!mem_usage_gb_s()!@/(60*60)) as mem_usage_gb_hrs_avg,
	stddev(@!mem_usage_gb_s()!@/(60*60))/sqrt(count(*)) as mem_usage_gb_hrs_se,
	sum(cpu_time)/(60*60*24*7) as cpu_time_weeks,
	sum(@!core_wall_time()!@)/(60*60*24*7) as core_wall_time_weeks,
	100.0*min(cpu_time/@!core_wall_time()!@) as cpu_eff_min,
	100.0*max(cpu_time/@!core_wall_time()!@) as cpu_eff_max,
	100.0*avg(cpu_time/@!core_wall_time()!@) as cpu_eff_avg,
	100.0*stddev(cpu_time/@!core_wall_time()!@)/sqrt(count(*)) as cpu_eff_se,
	100.0*sum(cpu_time)/sum(@!core_wall_time()!@) as cpu_eff_total,
	(sum(@!core_wall_time()!@)-sum(cpu_time))/(60*60*24*7) as wasted_core_weeks,
	avg(num_slots) as n_slots_avg,
	stddev(num_slots)/sqrt(count(*)) as n_slots_se,
	avg(@!wall_time()!@)/3600 as run_time_hrs_avg,
	stddev(@!wall_time()!@)/3600/sqrt(count(*)) as run_time_hrs_se,
	count(*) as num_jobs
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
	and finish_time_gmt >= '@!start_date!@'
	and finish_time_gmt <= '@!end_date!@'
	and finish_time_gmt > start_time_gmt
	and run_time > 0
	and num_slots > 0
	and cpu_time/run_time < 1024
	and cpu_time > 0
	and mem_usage > 0
	and mem_req > 0
<!--(if exists("cluster"))-->
	and cluster_name = '@!cluster!@'
<!--(end)-->
<!--(if exists("project"))-->
	and pname = '@!project!@'
<!--(end)-->
<!--(if exists("sql_conds"))-->
	<!--(for cond in sql_conds)-->
	and ($!cond!$)
	<!--(end)-->
<!--(end)-->
<!--(if exists("usernames"))-->
	and user_name in $!sql_in(list=usernames)!$
<!--(end)-->
group by user_name
<!--(if exists("limit"))-->
limit @!limit!@
<!--(end)-->

