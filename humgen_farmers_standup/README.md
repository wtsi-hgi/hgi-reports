Humgen Farmers Standup Report
=============================
Python script which merges data from the LSF analytics vertica database with a LaTeX template, which can then be used to generate a pdf (using `pdflatex`). Uses the pyratemp templating engine due to it's syntax playing nicely with LaTeX source without any hassle.

It now uses the jaydebeapi module to load a JDBC driver via jpype. You will need to have the vertica jar file and the username & password for the vertica db to use this with LSF analytics.
