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
where r.project_name = g.cname
	and pname = 'humgen'
	and finish_time_gmt >= '@!start_date!@'
	and finish_time_gmt < '@!end_date!@'
	and cluster_name = 'farm3'
	and finish_time_gmt > start_time_gmt
	and run_time > 0
	and nprocs > 0
	and ncores > 0
	and cpu_time/run_time < 1024
	and cpu_time > 0
	and job_exit_status = 'EXIT'
	and user_name = '@!username!@'
group by user_name
