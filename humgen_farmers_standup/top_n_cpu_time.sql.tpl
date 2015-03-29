select
	user_name as user_name,
	sum(cpu_time)/(60*60*24*7) as @!prefix!@core_weeks,
	100.0*min(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as @!prefix!@cpu_eff_min,
	100.0*max(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as @!prefix!@cpu_eff_max,
	100.0*sum(cpu_time)/sum(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))) as @!prefix!@cpu_eff_avg,
	100.0*stddev(cpu_time/(ncores*(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt)))) as @!prefix!@cpu_eff_stddev,
	count(*) as @!prefix!@num_jobs,
	avg(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))/3600 as @!prefix!@run_time_avg_hrs
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
	and finish_time_gmt >= '@!start_date!@'
	and finish_time_gmt < '@!end_date!@'
	and finish_time_gmt > start_time_gmt
	and run_time > 0
	and nprocs > 0
	and ncores > 0
	and cpu_time/run_time < 1024
	and cpu_time > 0
<!--(if exists("cluster"))-->
	and cluster_name = '@!cluster!@'
<!--(end)-->
<!--(if exists("project"))-->
	and pname = '@!project!@'
<!--(end)-->
<!--(if exists("exit_status"))-->
	and job_exit_status = '@!exit_status!@'
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
