<!--(macro wall_time)-->
(extract(epoch from finish_time_gmt)-extract(epoch from start_time_gmt))
<!--(end)-->
<!--(macro core_wall_time)-->
(num_slots*(@!wall_time()!@))
<!--(end)-->
<!--(macro mem_req_gb)-->
(CASE WHEN MEM_REQ IS NULL THEN (CASE WHEN SUBMIT_TIME < '2012-02-21 16:00:00.0' THEN 2000.0/1024 ELSE 100.0/1024 END) ELSE MEM_REQ/1024.0 END)
<!--(end)-->
<!--(macro mem_req_gb_s)-->
((@!mem_req_gb()!@)*(@!wall_time()!@))
<!--(end)-->
<!--(macro mem_usage_gb)-->
mem_usage/1024.0/1024.0
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
