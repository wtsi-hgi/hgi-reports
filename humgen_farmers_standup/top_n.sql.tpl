<!--(include)-->
  jobmart_sql_macros.tpl
<!--(end)-->
select * from (select
	user_name as user_name,
<!--(if exists("select_tpls") and "cpu" in select_tpls)-->
  <!--(include)-->
  jobmart_cpu_select.tpl
  <!--(end)-->
<!--(end)-->
<!--(if exists("select_tpls") and "mem" in select_tpls)-->
  <!--(include)-->
  jobmart_mem_select.tpl
  <!--(end)-->
<!--(end)-->
	count(*) as num_jobs
from rpt_jobmart_raw as r, isg_work_area_groups as g
where r.project_name = g.cname
<!--(include)-->
  jobmart_where.tpl
<!--(end)-->
group by user_name
) as agg
<!--(if exists("agg_where") and agg_where != "")-->
where $!agg_where!$
<!--(end)-->
<!--(if exists("order_by") and order_by != "")-->
order by $!order_by!$ <!--(if exists("desc") and desc)-->desc<!--(end)-->
<!--(end)-->
<!--(if exists("limit") and limit >= 0)-->
limit $!limit!$
<!--(end)-->
