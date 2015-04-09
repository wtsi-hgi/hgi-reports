<!--(include)-->
  jobmart_sql_macros.tpl
<!--(end)-->
select
	user_name as user_name,
<!--(include)-->
  jobmart_mem_select.tpl
<!--(end)-->
	count(*) as num_jobs
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
<!--(include)-->
  jobmart_where.tpl
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
