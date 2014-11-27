Humgen Farmers Standup Report
=============================
Python script which merges data from the vertica LSF stats database with a LaTeX template and generates a pdf. Uses the pyratemp templating engine due to it's syntax playing nicely with LaTeX source without any hassle.

It uses the subprocess module to call out to a java program that uses the vertica jdbc driver to interact with the backend database. The java program sned the data back in the form of a list of rows, with each element containing a list of the columns. This is formatted in a pythonic way so that you can just slurp it into a string then eval it to get the data structure. You will need to have the vertica jar file and the username & password for the vertica db.
