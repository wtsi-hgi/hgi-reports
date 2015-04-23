<!--(macro display_se)-->
  <!--(if default(se))-->#!
    <!--(if float(default(se)) < float('inf'))-->#!
$\pm$$! "%.1f" % float(1.96*default(se)) !$#!
    <!--(end)-->#!
  <!--(end)-->#!
<!--(end)-->
%% latex template for weekly stats
\documentclass[a4paper,9pt]{extarticle}

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
{\large\bfseries Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@)}

<!--(for section in sections)-->
\subsection*{Top @!n!@ users - $!section["title"]!$}
  <!--(if section["table_type"] == "cpu")-->
\begin{longtable}{L{\photowidth} L{\namewidth}|R{14mm} R{14mm} R{14mm} R{14mm} R{9mm} R{17mm} R{17mm}}
& Name & Compute cores reserved (core-weeks) & Compute cores used (core-weeks) & Compute wasted (core-weeks) & Total compute efficiency (\%) & Jobs (\#) & Cores per job & Avg. job wall time (Hours) \\
    <!--(for user in top_n_users[section["key"]])-->#!
$!setvar("done", "user_details[user]['done']")!$#!
$!setvar("failed", "user_details[user]['failed']")!$#!
\hline
%%% USER $!user!$ TOP ROW
\multirow{2}{\photowidth}{#!
\includegraphics[height=10mm]{@!user_data[user]['jpeg_filename']!@}}#!
& \multirow{2}{\namewidth}{@! "%.26s" % user_data[user]['full_name']!@ (@!user!@)}#!
& @! default("'%.1f' % float(done['core_wall_time_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['cpu_time_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['wasted_core_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['cpu_eff_total'])", "") !@#!
& @! default("int(done['num_jobs'])", 0) !@#!
& @! default("'%.1f' % float(done['n_slots_avg'])", "") !@@!display_se(se="done['n_slots_se']")!@#!
& @! default("'%.1f' % float(done['run_time_hrs_avg'])", "") !@@!display_se(se="done['run_time_hrs_se']")!@#!
\\
%%% USER $!user!$ BOTTOM ROW
#! empty for multirow photo
& #! empty for multirow name
& \textcolor{red}{@! default("'%.1f' % float(failed['core_wall_time_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['cpu_time_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['wasted_core_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['cpu_eff_total'])", "") !@}#!
& \textcolor{red}{@! default("int(failed['num_jobs'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['n_slots_avg'])", "") !@@!display_se(se="failed['n_slots_se']")!@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['run_time_hrs_avg'])", "") !@@!display_se(se="failed['run_time_hrs_se']")!@}#!
\\
    <!--(end)-->#!
\end{longtable}
  <!--(elif section["table_type"] == "mem")-->
\begin{longtable}{L{\photowidth} L{\namewidth}|R{14mm} R{14mm} R{14mm} R{14mm} R{9mm} R{17mm} R{17mm} R{17mm}}
& Name & Memory reserved (GB-weeks) & Memory used (GB-weeks) & Memory wasted (GB-weeks) & Total memory efficiency (\%) & Jobs (\#) & Memory reserved per job (GB) & Memory used per job (GB) & Avg. job wall time (Hours) \\
    <!--(for user in top_n_users[section["key"]])-->#!
$!setvar("done", "user_details[user]['done']")!$#!
$!setvar("failed", "user_details[user]['failed']")!$#!
\hline
%%% USER $!user!$ TOP ROW
\multirow{2}{\photowidth}{\includegraphics[height=10mm]{@!user_data[user]['jpeg_filename']!@}}#!
& \multirow{2}{\namewidth}{@! "%.26s" % user_data[user]['full_name']!@ (@!user!@)}#!
& @! default("'%.1f' % float(done['mem_req_gb_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['mem_usage_gb_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['wasted_mem_gb_weeks'])", 0) !@#!
& @! default("'%.1f' % float(done['mem_eff_total'])", "") !@#!
& @! default("int(done['num_jobs'])", 0) !@#!
& @! default("'%.1f' % float(done['mem_req_gb_avg'])", "") !@@!display_se(se=done['mem_req_gb_se'])!@#!
& @! default("'%.1f' % float(done['mem_usage_gb_avg'])", "") !@@!display_se(se="done['mem_usage_gb_se']")!@#!
& @! default("'%.1f' % float(done['run_time_hrs_avg'])", "") !@@!display_se(se="done['run_time_hrs_se']")!@#!
\\
%%% USER $!user!$ BOTTOM ROW
#! empty for multirow photo
&#! empty for multirow name
& \textcolor{red}{@! default("'%.1f' % float(failed['mem_req_gb_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['mem_usage_gb_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['wasted_mem_gb_weeks'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['mem_eff_total'])", "") !@}#!
& \textcolor{red}{@! default("int(failed['num_jobs'])", 0) !@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['mem_req_gb_avg'])", "") !@@!display_se(se="failed['mem_req_gb_se']")!@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['mem_usage_gb_avg'])", "") !@@!display_se(se="failed['mem_usage_gb_se']")!@}#!
& \textcolor{red}{@! default("'%.1f' % float(failed['run_time_hrs_avg'])", "") !@@!display_se(se="failed['run_time_hrs_se']")!@}#!
\\
    <!--(end)-->#!
\end{longtable}
  <!--(end)-->
<!--(end)-->

%\newpage
%{\large\bfseries Human Genetics Farmers' Stats (@!start_date!@ to @!end_date!@)}

\end{document}
