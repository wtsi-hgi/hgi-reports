	and finish_time_gmt >= '@!start_date!@'
	and finish_time_gmt <= '@!end_date!@'
	and finish_time_gmt > start_time_gmt
	and num_slots > 0
	and cpu_time > 0
	and $!core_wall_time()!$ > 0
	and cpu_time / $!core_wall_time()!$ < 30000
	and mem_usage > 0
	and $!mem_req_gb()!$ > 0
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
