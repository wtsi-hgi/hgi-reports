%% latex template for weekly stats
\documentclass{article}[10pt]

\usepackage{graphicx}
\usepackage[margin=4mm]{geometry}
\usepackage{longtable,multirow}
\usepackage{array}
\usepackage{xcolor}
\newcolumntype{L}[1]{>{\raggedright\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\newcolumntype{C}[1]{>{\centering\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\newcolumntype{R}[1]{>{\raggedleft\let\newline\\\arraybackslash\hspace{0pt}}m{#1}}
\renewcommand{\arraystretch}{1.2}
\begin{document}
Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@)
\section*{Top @!n!@ compute users}
\begin{longtable}{|l|L{40mm}|R{20mm}|R{20mm}|R{20mm}|R{15mm}|R{10mm}|R{10mm}|R{10mm}|}
\hline
 & Name & Compute cores reserved (core-weeks) & Compute cores used (core-weeks) & Compute wasted (core-weeks) & Total compute efficiency (\%) & \# Jobs & Avg. cores & Avg. run time (Hours) \\
\hline
\hline
<!--(for row in top_n_cpu)-->
\multirow{2}{*}{\includegraphics[height=10mm]{@!user_data[row['user_name']]['jpeg_filename']!@}} & \multirow{2}{40mm}{@!user_data[row['user_name']]['full_name']!@ (@!row['user_name']!@)} & @! "%.2f" % float(row['done_core_wall_time_weeks']) !@ & @! "%.2f" % float(row['done_cpu_time_weeks']) !@ & @! "%.2f" % float(row['done_wasted_core_weeks']) !@ & @! "%.2f" % float(row['done_cpu_eff_total']) !@ & @! int(row['done_num_jobs']) !@ & @! "%.2f" % float(row['done_n_slots_avg']) !@ & @! "%.2f" % float(row['done_run_time_avg_hrs']) !@ \\
& & \textcolor{red}{@! "%.2f" % float(row['failed_core_wall_time_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_cpu_time_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_wasted_core_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_cpu_eff_total']) !@} & \textcolor{red}{@! int(row['failed_num_jobs']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_n_slots_avg']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_run_time_avg_hrs']) !@} \\
\hline
<!--(end)-->
\end{longtable}


\section*{Top @!n!@ memory users}
\begin{longtable}{|l|L{40mm}|R{20mm}|R{20mm}|R{20mm}|R{15mm}|R{10mm}|R{10mm}|R{10mm}|}
\hline
 & Name & Memory reserved (GB-weeks) & Memory used (GB-weeks) & Memory wasted (GB-weeks) & Total memory efficiency (\%) & \# Jobs & Avg. peak job memory (GB) & Avg. run time (Hours) \\
\hline
\hline
<!--(for row in top_n_mem)-->
\multirow{2}{*}{\includegraphics[height=10mm]{@!user_data[row['user_name']]['jpeg_filename']!@}} & \multirow{2}{40mm}{@!user_data[row['user_name']]['full_name']!@ (@!row['user_name']!@)} & @! "%.2f" % float(row['done_mem_req_gb_weeks']) !@ & @! "%.2f" % float(row['done_mem_usage_gb_weeks']) !@ & @! "%.2f" % float(row['done_wasted_mem_gb_weeks']) !@ & @! "%.2f" % float(row['done_mem_eff_total']) !@ & @! int(row['done_num_jobs']) !@ & @! "%.2f" % float(row['done_mem_usage_gb_avg']) !@ & @! "%.2f" % float(row['done_run_time_avg_hrs']) !@ \\
& & \textcolor{red}{@! "%.2f" % float(row['failed_mem_req_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_mem_usage_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_wasted_mem_gb_weeks']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_mem_eff_total']) !@} & \textcolor{red}{@! int(row['failed_num_jobs']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_mem_usage_gb_avg']) !@} & \textcolor{red}{@! "%.2f" % float(row['failed_run_time_avg_hrs']) !@} \\
\hline
<!--(end)-->
\end{longtable}

\end{document}
