<!--(include)-->
  jobmart_sql_macros.tpl
<!--(end)-->
select
	user_name as user_name,
<!--(include)-->
  jobmart_mem_select.tpl
<!--(end)-->
<!--(include)-->
  jobmart_cpu_select.tpl
<!--(end)-->
	count(*) as num_jobs
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
<!--(include)-->
  jobmart_where.tpl
<!--(end)-->
<!--(if exists("usernames"))-->
	and user_name in $!sql_in(list=usernames)!$
<!--(end)-->
group by user_name
<!--(if exists("limit"))-->
limit $!limit!$
<!--(end)-->

