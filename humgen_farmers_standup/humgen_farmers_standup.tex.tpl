%% latex template for weekly stats
\documentclass[9pt]{extarticle}

\usepackage{graphicx}
\usepackage[margin=4mm]{geometry}
\usepackage{longtable,multirow}
\usepackage{array}
\usepackage{xcolor}
\newcolumntype{L}[1]{>{\raggedright\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\newcolumntype{C}[1]{>{\centering\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\newcolumntype{R}[1]{>{\raggedleft\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\renewcommand{\arraystretch}{1.2}
\newcommand{\namewidth}{30mm}
\newcommand{\photowidth}{5mm}

\begin{document}
% Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@)
\section*{Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@): top @!n!@ compute users}
\begin{longtable}{L{\photowidth} L{\namewidth}|R{16mm} R{16mm} R{16mm} R{12mm} R{10mm} R{18mm} R{18mm}}
& Name & Compute cores reserved (core-weeks) & Compute cores used (core-weeks) & Compute wasted (core-weeks) & Total compute efficiency (\%) & Jobs (\#) & Cores per job & Avg. job wall time (Hours) \\
<!--(for row in top_n_cpu)-->
\hline
\multirow{2}{\photowidth}{\includegraphics[height=10mm]{@!user_data[row['user_name']]['jpeg_filename']!@}} & \multirow{2}{\namewidth}{@! "%.26s" % user_data[row['user_name']]['full_name']!@ (@!row['user_name']!@)} & @! "%.2f" % float(row['done_core_wall_time_weeks']) !@ & @! "%.2f" % float(row['done_cpu_time_weeks']) !@ & @! "%.2f" % float(row['done_wasted_core_weeks']) !@ & @! "%.2f" % float(row['done_cpu_eff_total']) !@ & @! int(row['done_num_jobs']) !@ & @! "%.1f" % float(row['done_n_slots_avg']) !@ $\pm$ @! "%.1f" % float(row['done_n_slots_stddev']) !@ & @! "%.1f" % float(row['done_run_time_hrs_avg']) !@ $\pm$ @! "%.1f" % float(row['done_run_time_hrs_stddev']) !@ \\
& & \textcolor{red}{@! "%.2f" % float(row['failed_core_wall_time_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_cpu_time_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_wasted_core_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_cpu_eff_total']) !@} & \textcolor{red}{@! int(row['failed_num_jobs']) !@} & \textcolor{red}{@! "%.1f" % float(row['failed_n_slots_avg']) !@ $\pm$ @! "%.1f" % float(row['failed_n_slots_stddev']) !@ } & \textcolor{red}{@! "%.1f" % float(row['failed_run_time_hrs_avg']) !@ $\pm$ @! "%.1f" % float(row['failed_run_time_hrs_stddev']) !@} \\
<!--(end)-->
\end{longtable}

\newpage

\section*{Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@): top @!n!@ memory users}
\begin{longtable}{L{\photowidth} L{\namewidth}|R{16mm} R{16mm} R{16mm} R{12mm} R{10mm} R{18mm} R{18mm} R{18mm}}
& Name & Memory reserved (GB-weeks) & Memory used (GB-weeks) & Memory wasted (GB-weeks) & Total memory efficiency (\%) & Jobs (\#) & Memory reserved per job (GB) & Memory used per job (GB) & Avg. job wall time (Hours) \\
<!--(for row in top_n_mem)-->
\hline
\multirow{2}{\photowidth}{\includegraphics[height=10mm]{@!user_data[row['user_name']]['jpeg_filename']!@}} & \multirow{2}{\namewidth}{@! "%.26s" % user_data[row['user_name']]['full_name']!@ (@!row['user_name']!@)} & @! "%.2f" % float(row['done_mem_req_gb_weeks']) !@ & @! "%.2f" % float(row['done_mem_usage_gb_weeks']) !@ & @! "%.2f" % float(row['done_wasted_mem_gb_weeks']) !@ & @! "%.2f" % float(row['done_mem_eff_total']) !@ & @! int(row['done_num_jobs']) !@ & @! "%.1f" % float(row['done_mem_req_gb_avg']) !@ $\pm$ @! "%.1f" % float(row['done_mem_req_gb_stddev']) !@ & @! "%.1f" % float(row['done_mem_usage_gb_avg']) !@ $\pm$ @! "%.1f" % float(row['done_mem_usage_gb_stddev']) !@ & @! "%.1f" % float(row['done_run_time_hrs_avg']) !@ $\pm$ @! "%.1f" % float(row['done_run_time_hrs_stddev']) !@ \\
& & \textcolor{red}{@! "%.2f" % float(row['failed_mem_req_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_mem_usage_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_wasted_mem_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_mem_eff_total']) !@} & \textcolor{red}{@! int(row['failed_num_jobs']) !@} & \textcolor{red}{@! "%.1f" % float(row['failed_mem_req_gb_avg']) !@ $\pm$ @! "%.1f" % float(row['failed_mem_req_gb_stddev']) !@} & \textcolor{red}{@! "%.1f" % float(row['failed_mem_usage_gb_avg']) !@ $\pm$ @! "%.1f" % float(row['failed_mem_usage_gb_stddev']) !@} & \textcolor{red}{@! "%.1f" % float(row['failed_run_time_hrs_avg']) !@ $\pm$ @! "%.1f" % float(row['failed_run_time_hrs_stddev']) !@} \\
<!--(end)-->
\end{longtable}

\end{document}
