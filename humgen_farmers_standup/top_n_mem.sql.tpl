<!--(macro wall_time)-->
(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))
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
select
	user_name as user_name,
	sum(@!mem_req_gb_s()!@)/(60*60*24*7) as @!prefix!@mem_req_gb_weeks,
	sum(@!mem_usage_gb_s()!@)/(60*60*24*7) as @!prefix!@mem_usage_gb_weeks,
	100.0*min(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as @!prefix!@mem_eff_min,
	100.0*max(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as @!prefix!@mem_eff_max,
	100.0*avg(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as @!prefix!@mem_eff_avg,
	100.0*stddev(@!mem_usage_gb_s()!@/@!mem_req_gb_s()!@) as @!prefix!@mem_eff_stddev,
	100.0*sum(@!mem_usage_gb_s()!@)/sum(@!mem_req_gb_s()!@) as @!prefix!@mem_eff_total,
	(sum(@!mem_req_gb_s()!@)-sum(@!mem_usage_gb_s()!@))/(60*60*24*7) as @!prefix!@wasted_mem_gb_weeks,
	avg(num_slots) as @!prefix!@n_slots_avg,
	stddev(num_slots) as @!prefix!@n_slots_stddev,
	avg(@!mem_req_gb!@) as @!prefix!@mem_req_gb_avg,
	stddev(@!mem_req_gb!@) as @!prefix!@mem_req_gb_stddev,
	avg(@!mem_usage_gb!@) as @!prefix!@mem_usage_gb_avg,
 	stddev(@!mem_usage_gb!@) as @!prefix!@mem_usage_gb_stddev,
	avg(@!mem_usage_gb_s()!@/(60*60)) as @!prefix!@mem_usage_gb_hrs_avg,
	stddev(@!mem_usage_gb_s()!@/(60*60)) as @!prefix!@mem_usage_gb_hrs_stddev,
	count(*) as @!prefix!@num_jobs,
	avg(@!wall_time()!@)/3600 as @!prefix!@run_time_hrs_avg,
	stddev(@!wall_time()!@)/3600 as @!prefix!@run_time_hrs_stddev
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
	and finish_time_gmt >= '@!start_date!@'
	and finish_time_gmt <= '@!end_date!@'
	and finish_time_gmt > start_time_gmt
	and run_time > 0
	and num_slots > 0
	and cpu_time/run_time < 1024
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
<!--(if exists("username"))-->
	and user_name = '@!username!@'
<!--(end)-->
group by user_name
<!--(if exists("order_by_desc"))-->
order by @!order_by_desc!@ desc
<!--(end)-->
<!--(if exists("limit"))-->
limit @!limit!@
<!--(end)-->
