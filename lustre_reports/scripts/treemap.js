define(["d3", "lodash", "queue"], function(d3, _, queue) {
    console.log("treemap using d3 v"+d3.version+", underscore v"+_.VERSION+", queue v"+queue.version);

    var BINARY_UNIT_LABELS  = ["B","KiB","MiB","GiB","TiB","PiB","EiB","ZiB","YiB"];
    var SI_UNIT_LABELS  = ["","k","M","G","T","P","E","Z","Y"];
    var HUMAN_TRIGGER_RATIO = 0.8;
    var OUTPUT_UNIT_SEP = " ";
    var HTTP_RETRY_COUNT = 5;

    var _root = new Object();
    var treemap = {
	get root() {
	    return _root;
	},
	set root(d) {
	    _root = d;
	},
	nodes: new Array(),
	layout: undefined,
	svg: undefined,
	grandparent: undefined,
	fillScale: "linear",
	sizeAccessor: undefined,
	fillAccessor: undefined,
	size: {
	    metric: "size",
	    group: "*",
	    user: "*",
	    tag: "*"
	},
	fill: {
	    metric: "count",
	    group: "*",
	    user: "*",
	    tag: "*"
	},
	loading: false,
	color: undefined,
	genColorScale: function(nodes, fillAccessor) {
	    // colors from colorbrewer2.org 5-class YlGnBu
	    low =  "#ffffcc";
	    lmid = "#a1dab4";
	    mid =  "#41b6c4";
	    hmid = "#2c7fb8";
	    high = "#253494";
	    
	    var min = d3.min(nodes, fillAccessor);
	    var max = d3.max(nodes, fillAccessor);
	    //console.log("genColorScale: min=", min, " max=", max, " for nodes=", nodes, " using fillAccessor=", fillAccessor);

	    if(treemap.fillScale == "linear") {
		if(min > 0) {
		    min = -1;
		}
		if(max < 0) {
		    max = 1;
		}
		return d3.scale.linear()
		    .interpolate(d3.interpolateHsl)
		    .domain([min, min/2, 0, max/2, max])
		    .range([low, lmid, mid, hmid, high])
	            .nice();
	    } else {
		if(min <= 0) {
		    min = 0.001;
		}
		if(max <= 0) {
		    max = 1;
		}
		var log_min = Math.floor(Math.log(min));
		var log_max = Math.ceil(Math.log(max));
		var log_range = log_max - log_min;
		var log_mid = Math.floor(log_min+(log_range/2));
		var log_lmid = Math.floor(log_min+((log_mid-log_min)/2));
		var log_hmid = Math.floor(log_max-((log_mid-log_min)/2));
		//console.log("genColorScale: log domain=", Math.pow(10, log_min), Math.pow(10, log_lmid), Math.pow(10, log_mid), Math.pow(10, log_hmid), Math.pow(10, log_max))
		return d3.scale.log()
		    .interpolate(d3.interpolateHsl)
		    .domain([Math.pow(10, log_min), Math.pow(10, log_lmid), Math.pow(10, log_mid), Math.pow(10, log_hmid), Math.pow(10, log_max)])
		    .range([low, lmid, mid, hmid, high])
	            .nice();
	    }
	}
    };
    
    var margin = {top: 20, right: 0, bottom: 20, left: 0},
    width = 960 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom,
    formatNumber = d3.format(",d"), 
    transitioning;
    
    var x = d3.scale.linear()
        .domain([0, width])
        .range([0, width])
	.nice();
    
    var y = d3.scale.linear()
        .domain([0, height])
        .range([0, height])
	.nice();
    
    var title = d3.select("#footer").insert("div", ":first-child");
    
    var node;

    var curg; // current g element

    function getValueAccessor(params) {
	return function(d) {
	    //console.log("calling valueAccessor on d=", d, " with metric=", params.metric, " group=", params.group, " user=", params.user, " tag=", params.tag);
	    return valueAccessor(d, params.metric, params.group, params.user, params.tag);
	}
    }

    treemap.sizeAccessor = getValueAccessor(treemap.size);
    console.log("treemap.sizeAccessor set to: ", treemap.sizeAccessor);

    treemap.fillAccessor = getValueAccessor(treemap.fill);
    console.log("treemap.fillAccessor set to: ", treemap.fillAccessor);
    
    var fillColor = function(d) {
	var value = treemap.fillAccessor(d);
	var hsl = treemap.color(value);
	//console.log("fillColor: value=", value, " hsl=", hsl, " for d=", d);
	return hsl;
    }
    
    var sizeValue = function(d) {
	var value = treemap.sizeAccessor(d);
	//console.log("sizeValue: value=", value, " for d=", d);
	if (_.isNaN(value)) {
	    value = -1;
	}
	return value;
    }

    function displayKey(metric, group, user, tag) {
	var display_key = metric;
	if (display_key == "ctime") {
	    display_key = "Cost since creation";
	} else if (display_key == "atime") {
	    display_key = "Cost since last accessed";
	} else if (display_key == "mtime") {
	    display_key = "Cost since last modified";
	} else {
	    display_key = _.capitalize(display_key);
	}
	var limits = [];
	if (!_.isUndefined(group) && group != "*") {
	    limits.push("g:" + group);
	}
	if (!_.isUndefined(user) && user != "*") {
	    limits.push("u:" + user);
	}
	if (!_.isUndefined(tag) && tag != "*") {
	    limits.push("t:" + tag);
	}
	if (limits.length > 0) {
	    display_key += " ("+limits.join(" & ")+")";
	}
	return display_key;
    }
    
    function valueAccessor(d, metric, group, user, tag) {
	//console.log("valueAccessor: d=", d, " metric=", metric, " group=", group, " user=", user, " tag=", tag)
	if (_.isUndefined(metric)) {
	    console.log("valueAccessor: ERROR metric undefined for d.data=", d.data);
	    return -1;
	}
	if (metric == "path") {
	    return d.path;
	}
	if (metric == "name") {
	    return d.name;
	}
	if (_.isUndefined(group)) {
	    group = "*";
	}
	if (_.isUndefined(user)) {
	    user = "*";
	} 
	if (_.isUndefined(tag)) {
	    tag = "*";
	}
	if (_.isObject(d.data)) {
	    if (!(metric in d.data)) {
		console.log("valueAccessor: ERROR metric=", metric, " not in d.data=", d.data);
		return -1;
	    }
	    if (!(group in d.data[metric])) {
		console.log("valueAccessor: ERROR group=", group, " not in d.data=", d.data);
		return -1;
	    }
	    if (!(user in d.data[metric][group])) {
		console.log("valueAccessor: ERROR user=", user, " not in d.data=", d.data);
		return -1;
	    }
	    if (!(tag in d.data[metric][group][user])) {
		console.log("valueAccessor: ERROR tag=", tag, " not in d.data=", d.data);
		return -1;
	    }
	    var value = d.data[metric][group][user][tag];
	    if (_.isUndefined(value)) {
		console.log("valueAccessor: ERROR undefined value for metric=", metric, " group=", group, " user=", user, " tag=", tag);
		return -1;
	    }
	    return +value;
	} else {
	    // d.data not an object
	    console.log("valueAccessor: ERROR d.data not an object. d=", d);
	    return -1;
	}
    }

    function displayValue(d, metric, group, user, tag) {
	if (_.isUndefined(metric)) {
	    console.log("displayValue: ERROR metric undefined for d=", d);
	    return "ERROR";
	}
	if (_.isUndefined(group)) {
	    group = "*";
	}
	if (_.isUndefined(user)) {
	    user = "*";
	} 
	if (_.isUndefined(tag)) {
	    tag = "*";
	}
	var value = valueAccessor(d, metric, group, user, tag);
	if (/^size$/.exec(metric)) {
	    return bytes_to_human_readable_string(value);
	} else if(/time$/.exec(metric)) { // really cost - TODO: fix server to say "atime_cost" etc
	    return "£" + value.toFixed(2);
	} else if(/^count$/.exec(metric)) {
	    return count_to_human_readable_string(value);
	} else {
	    return value;
	}
    }
    
    treemap.layout = d3.layout.treemap()
	.children(function(d, depth) {return depth ? null : d.child_dirs; })
//	.size([960, 500])
	.sort(function(a, b) {return a.value - b.value; })
//	.ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
//	.ratio(width/height * 0.5 * (1 + Math.sqrt(5)))
	.round(false);
    
    treemap.svg = d3.select("#chart").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.bottom + margin.top)
	.style("margin-left", -margin.left + "px")
	.style("margin.right", -margin.right + "px")
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
	.style("shape-rendering", "crispEdges");
    
    treemap.grandparent = treemap.svg.append("g")
	.classed("grandparent", true);
    
    treemap.grandparent.append("rect")
	.attr("y", -margin.top)
	.attr("width", width)
	.attr("height", margin.top);
    
    treemap.grandparent.append("text")
	.attr("x", 6)
	.attr("y", 6 - margin.top)
	.attr("dy", ".75em");

    var path_data_url_templates = {
	"/lustre/scratch111": _.template("../api/lustretree/scratch111?depth=2&path=<%= path %>"),
	"/lustre/scratch113": _.template("../api/lustretree/scratch113?depth=2&path=<%= path %>"),
	"/lustre/scratch114": _.template("../api/lustretree/scratch114?depth=2&path=<%= path %>"),
    }

    function queueTreemapDataRequests(d) {
	//console.log("queueTreemapDataRequests d=", d);
	var q = queue();
	_.forEach(path_data_url_templates, function(n, root_path) {
	    if(_.startsWith(d.path, root_path) || _.startsWith(root_path, d.path)) {
		url = path_data_url_templates[root_path](d);
		console.log("queueTreemapDataRequests: requesting url="+url);
		q.defer(d3.json, url);
	    }
	});
	return q;
    }

    function awaitTreemapDataRequests(q, retry_d, treemap, onload_cb) {
	//console.log("awaitTreemapDataRequests d=", d, " old_root=", old_root);
	q.await(function() {
	    //console.log("awaitTreemapDataRequests: have treemap.root:", treemap.root);
	    error = _(arguments).shift();
	    data = arguments;
	    if(error) {
		if(error.status == 401) {
		    console.log("Client unauthorized ("+error.status+" ", error.statusText,"): ", error.responseText);
		    console.log("Should handle authorization TODO!");
		    treemap.loading = false;
		} else if(error.status >= 500 && error.status < 600) {
		    console.log("Server error "+error.status+" (", error.statusText,"): ", error.responseText);
		    http_retries--;
		    if(http_retries > 0) {
			console.log("Retrying request for retry_d=", retry_d);
			fetchTreemapData(retry_d, treemap, onload_cb);
		    } else {
			console.log("No more retries! Giving up.");
			console.log("Should report this to user TODO!");
			treemap.loading = false;
		    }
		} else if(error.status >= 400 && error.status < 500) {
		    console.log("Client error ("+error.status+" ", error.statusText,"): ", error.responseText);
		    console.log("Should print to page TODO!");
		    treemap.loading = false;
		} else if(error.status == 0) {
		    console.log("CORS error, possibly from shibboleth redirect?");
		    console.log(error.getAllResponseHeaders());
		    treemap.loading = false;
		    //TODO fix reload to take us back where we were
		    window.location.reload();
		} else {
		    console.log("Unexpected error ", error.readyState,  error.response, error.responseText, error.responseType, error.responseXML, error.status, error.statusText, error.timeout, error.withCredentials);
		    console.log(error.getAllResponseHeaders());
		    treemap.loading = false;
		    //TODO fix reload to take us back where we were
		    window.location.reload();
		}
	    } else { // successful result
		http_retries = HTTP_RETRY_COUNT;
		if(_.every(data, _.isObject) && data.length >= 1) {
		    if (_.isEmpty(treemap.root)) {
			var d = _(data).shift();
			console.log("treemap.root is empty: ", treemap.root, "setting to d:", d);
			treemap.root = d;
		    }
		    _.forEach(data, function(d) {
			console.log("merging d into treemap.root. d=", d);
			mergeLustreTree(treemap.root, d);
		    });
		    
		    //initialDataLoad();
		    var result = _.attempt(onload_cb);

		    if (_.isError(result)) {
			console.log("Error invoking onload_cb ", onload_cb);
			console.log("error was ", result.name, ": ", result.message, "(", result.fileName, " line ", result.lineNumber, ")");
		    }
		    
		} else {
		    console.log("queue completed but data missing. have data=", data);
		}
	    }
	    treemap.loading = false;
	});
    }

    function fetchTreemapData(d, treemap, load_callback) {
	//console.log("fetchTreemapData d=", d, "treemap.root=", treemap.root)
	treemap.loading = true;
	var q = queueTreemapDataRequests(d);
	awaitTreemapDataRequests(q, d, treemap, load_callback)
    }
    
    var http_retries = HTTP_RETRY_COUNT;
    fetchTreemapData({path: "/lustre"}, treemap, initialDataLoad);

    function mergeLustreTree(x, y) {
	var merged = x;
	//console.log("mergeLustreTree: merging y.path=", y.path, " into merged.path=", merged.path);
	var subtree = merged;
	while (subtree.path != y.path) {
	    var child_dirs = subtree.child_dirs;
	    subtree = _.find(child_dirs, function(child) {return ((y.path == child.path) || _.startsWith(y.path, child.path+"/"));});
	    
	    if (_.isUndefined(subtree)) {
		console.log("mergeLustreTree: ERROR cannot find subtree for merge - are trees disjoint? (y=", y, " x=", x, " child_dirs=", child_dirs);
		return merged;
	    }
	}

	// have subtree to merge, just verify name and path are identical
	if (subtree.name == y.name && subtree.path == y.path) {
	    //console.log("mergeLustreTree: have subtree.path=", subtree.path, " subtree=", subtree, " y=", y);
	    
	    if (_.isUndefined(subtree["child_dirs"])) { // subtree has no children
		if (!_.isUndefined(y["child_dirs"])) { // y does have children
		    // just go with child_dirs and data from y
		    //console.log("mergeLustreTree: don't have any child_dirs for subtree, returning y[child_dirs]=", y["child_dirs"]);
		    subtree["child_dirs"] = y["child_dirs"];
		    subtree["data"] = y["data"];
		}
	    } else { // subtree has children
		if (_.isUndefined(subtree["data"])) { // subtree has no data (this is unexpected)
		    //console.log("mergeLustreTree: don't have any data for subtree, returning y[data]=", y["data"]);
		    subtree["data"] = y["data"];
		} else { // subtree has data
		    if (!_.isUndefined(y["data"])) { // y has data
			// data needs to be merged
			//console.log("mergeLustreTree: merging data at subtree.path=", subtree.path, " subtree[data]=", subtree["data"], " and y[data]=", y["data"]);
			// to merge data, we must have completely disjoint children (otherwise we may be adding data that represents the same children twice)
			var common_children_paths = _.intersection(_.map(subtree["child_dirs"], path), _.map(y["child_dirs"], path))
			if (common_children_paths.length == 0) {
			    console.log("have no common child paths between subtree[child_dirs]=", subtree["child_dirs"], " and y[child_dirs]=", y["child_dirs"], " going ahead with data merge for subtree.data=", subtree.data, " y.data=", y.data);
			    subtree["data"] = mergeData(subtree["data"], y["data"]);
			} else {
			    // just keep subtree["data"] as it is
			    //console.log("mergeLustreTree: refusing to merge data for subtree.path=", path(subtree), " with common_children_paths=", common_children_paths);
			}
		    }
		}
		
		//console.log("mergeLustreTree: merging children subtree[child_dirs]=", subtree["child_dirs"], " and y[child_dirs]=", y["child_dirs"]);
		subtree["child_dirs"] = mergeChildren(subtree["child_dirs"], y["child_dirs"]);
	    }
	    
	    return subtree;
	} else {
	    console.log("mergeLustreTree: unexpectedly didn't have equal name and path for subtree=", subtree, " merging y=", y);
	    return undefined;
	}
    }

    function mergeData(x, y) {
	//console.log("mergeData: x=", x, " y=", y);
	var merged;
	if (_.isObject(x) && _.isObject(y)) {
	    merged = new Object();
	    _.forEach(_.union(_.keys(x), _.keys(y)), function(key) {
		//console.log("mergeData recursing to process key=", key);
		merged[key] = mergeData(x[key], y[key]);
	    });
	} else if (_.isUndefined(x) && _.isObject(y)) {
	    merged = y;
	} else if (_.isUndefined(y) && _.isObject(x)) {
	    merged = x;
	} else if (_.isUndefined(x) && !_.isUndefined(y)) {
	    merged = +y;
	    if (_.isNaN(merged)) {
		console.log("x was undefined, set merged to y but it is NaN. y=", y);
		merged = y;
	    }
	} else if (_.isUndefined(y) && !_.isUndefined(x)) {
	    merged = +x;
	    if (_.isNaN(merged)) {
		console.log("y was undefined, setting merged to x but it is NaN. x=", x);
		merged = x;
	    }
	} else if(_.isFinite(+x) && _.isFinite(+y)) {
	    merged = +x + +y;
	    if (_.isNaN(merged)) {
		console.log("x and y are finite, setting merged to x+y but it is NaN. merged=", merged);
	    }
	} else {
	    console.log("mergeData: ERROR don't know how to merge x=", x, " y=", y);
	    return -1;
	}
	//console.log("mergeData: returning merged=", merged, " for x=", x, " y=", y);
	return merged;
    }

    function mergeChildren(x, y) {
	var merged_children = new Array();
	_.forEach(_.union(_.map(x, path), _.map(y, path)), function(child_path) {
	    var x_children = _.filter(x, function(d) {
		return child_path == path(d);
	    });
	    var num_x_children = _.size(x_children);
	    
	    var y_children = _.filter(y, function(d) {
		return child_path == path(d);
	    });
	    var num_y_children = _.size(y_children);
	    
	    if (num_x_children == 1 && num_y_children == 0) {
		//console.log("mergeChildren: using x_children for child_path=", child_path);
		merged_children.push(x_children[0]);
	    } else if (num_x_children == 0 && num_y_children == 1) {
		//console.log("mergeChildren: using y_children for child_path=", child_path);
		merged_children.push(y_children[0]);
	    } else if (num_x_children == 1 && num_y_children == 1) {
		//console.log("mergeChildren: recursively merging child_path=", child_path);
		var children = mergeLustreTree(x_children[0], y_children[0]);
		//console.log("mergeChildren: children=", children);
		merged_children.push(children);
	    } else if (num_x_children == 0 && num_y_children == 0) {
		console.log("mergeChildren: unexpectedly had no children for child_path=", child_path);
	    } else if (num_x_children > 1 || num_y_children > 1) {
		console.log("mergeChildren: unexpectedly had more than one child for child_path=", child_path);
	    } else {
		console.log("mergeChildren: unexpected error for child_path=", child_path, " x_children=", x_children, " y_children=", y_children);
	    }
	});
	
	//console.log("mergeChildren: returning merged_children=", merged_children);
	return merged_children;
    }

    function bytes_to_human_readable_string(bytes) {
	var base = 1024;
	var labels = BINARY_UNIT_LABELS;

	var unit_index = 0; 
	while(unit_index < (labels.length-1)) {
	    var unitmax = Math.pow(base, (unit_index+1)) * HUMAN_TRIGGER_RATIO;
	    if (bytes < unitmax) {
		break;
	    }
	    unit_index++;
	}
	
	return (bytes / Math.pow(base, unit_index)).toFixed(1) + OUTPUT_UNIT_SEP + labels[unit_index];
    }

    function count_to_human_readable_string(count) {
	var base = 1000;
	var labels = SI_UNIT_LABELS;

	var unit_index = 0; 
	while(unit_index < (labels.length-1)) {
	    var unitmax = Math.pow(base, (unit_index+1)) * HUMAN_TRIGGER_RATIO;
	    if (count < unitmax) {
		break;
	    }
	    unit_index++;
	}
	
	return (count / Math.pow(base, unit_index)).toFixed(1) + OUTPUT_UNIT_SEP + labels[unit_index];
    }

    function initialDataLoad() {
	console.log("initialDataLoad: have treemap=", treemap);

	// set title text
	title.text("Humgen Lustre");
	
	// set size and color options
	var metric_keys = _.map(treemap.root.data, function(v, k) { return k; });
	console.log("initialDataLoad: metric_keys=", metric_keys);

	// var szM = d3.select("#selectSizeMetric option")
	//     .data(metric_keys, function(d) {
	// 	console.log("selectsizemetric data key returning d=", d);
	// 	return d;});
	// szM.exit().remove();
	// szM.enter().append("option");

	    // .attr("value", function(d) {return d;})
	    // .attr("id", function(d) {return "size_metric_"+d;})
	    // .text(function(d) {return d;});

//	_.each(treemap.root.data, function(value, metric){
	    // treemap.valueAccessors[key] = function(d) { 
	    // 	if( _.isObject(d) && _.has(d, key)) { 
	    // 	    return d[key]; 
	    // 	} else { 
	    // 	    return undefined; 
	    // 	} 
	    // }
	    // if(_.isNumber(+value)){ 
	    // 	var szM = d3.select("#selectSizeMetric").insert("option").attr("value",metric).attr("id","size_metric_"+metric).text(metric);
	    // 	var flM = d3.select("#selectFillMetric").insert("option").attr("value",metric).attr("id","fill_metric_"+metric).text(metric);
	    // }
//	});
	
	// set selected property on default option
//	d3.select("#size_metric_"+sizeMetric).attr("selected",1);
	//d3.select("#fill_"+fillKey).attr("selected",1);
	
	initialize(treemap.root);
	layout(treemap.root);
	// have to generate initial color scale after layout, as before that treemap.nodes is unset
	treemap.color = treemap.genColorScale(treemap.nodes, treemap.fillAccessor);
	console.log("treemap.color generator set to: ", treemap.color);

	curg = display(treemap.root);
	if (_.isUndefined(node)) {
	    console.log("setting node to treemap.root");
	    node = treemap.root; // TODO still needed?
	}
    }
	
    function initialize(root) {
	root.x = root.y = 0;
	root.dx = width;
	root.dy = height;
	root.depth = 0;
    }
    
    // Compute the treemap layout recursively such that each group of siblings
    // uses the same size (1×1) rather than the dimensions of the parent cell.
    // This optimizes the layout for the current zoom state. Note that a wrapper
    // object is created for the parent node for each group of siblings so that
    // the parent’s dimensions are not discarded as we recurse. Since each group
    // of sibling was laid out in 1×1, we must rescale to fit using absolute
    // coordinates. This lets us use a viewport to zoom.
    function layout(d, depth) {
//	console.log("layout: d=", d, " depth=", depth);
	if (_.isUndefined(depth)) {
	    depth = 0;
	}
	if (depth == 0) {
	    treemap.layout.value(treemap.sizeAccessor);
	    treemap.nodes = [];
	}
	
	if (d.child_dirs && depth < 3) {
	    //treemap.layout.size([d.width, d.height]);
	    var childNodes = treemap.layout.nodes({data: d.data, child_dirs: d.child_dirs});
	    treemap.nodes.push(childNodes);
	    d.child_dirs.forEach(function(c) {
		c.x = d.x + c.x * d.dx;
		c.y = d.y + c.y * d.dy;
		c.dx *= d.dx;
		c.dy *= d.dy;
		c.parent = d;
		layout(c, depth+1);
	    });
	}
	treemap.nodes = _.flatten(treemap.nodes);
	
//	console.log("layout: calling treemap.layout.nodes on d=", d);
//	treemap.nodes = treemap.layout.nodes(d);
//	console.log("layout: have treemap.nodes=", treemap.nodes);
//	console.log("layout: after layout, d=", d);
	
//	treemap.nodes = treemap.layout.nodes(d);
//console.log("treemap.nodes=", treemap.nodes);
	// d.child_dirs.forEach(function(c) {
	//     c.x = d.x + c.x * d.dx;
	//     c.y = d.y + c.y * d.dy;
	//     c.dx *= d.dx;
	//     c.dy *= d.dy;
	//     c.parent = d;
	//     //treemap.layout.nodes(c);
	//     //layout(c); // TODO is this required?
	// });
//	treemap.nodes = _.flatten(treemap.nodes);

	//console.log("layout: returning treemap.nodes=", treemap.nodes);
	return treemap.nodes;
    }
    
    function display(d) {
	console.log("display: d=", d);
	treemap.grandparent
	    .datum(d.parent)
	    .on("click", function(d) {
		if(!_.isUndefined(d)) {
		    //console.log("clicked grandparent=", d);
		    //console.log("grandparent clicked d.path="+d.path);
		    transition(d);
		} else {
		    console.log("grandparent undefined");
		}
	    })
	    .select("text")
	    .text(path(d));
	//minmax = calcMinMax(treemap.nodes, treemap.fillAccessor);

	var g1 = treemap.svg.insert("g", ".grandparent")
            .datum(d)
	    .classed("depth", true)
	    .attr("id", depthId);
	
	//console.log("creating tooltips for d.child_dirs=", d.child_dirs);
	var div = d3.select("#footer").selectAll("div.tooltip")
	    .data(d.child_dirs, path);
	div.exit().remove();
	div.enter().append("div")
	    .classed("tooltip", true)
	    .attr("id", tooltipId)
	    .style("opacity", 1e-6);
	
	//console.log("creating group element for d.child_dirs=", d.child_dirs);
	var parent_and_children = g1.selectAll("g.parent_and_children")
	    .data(d.child_dirs)
	    .enter().append("svg:g");

	parent_and_children
	    .classed("parent_and_children", true)
	    .on("mouseover", mouseover)
	    .on("mouseout", mouseout);

	parent_and_children
	    .on("click", function(child) {
		console.log("clicked child=", child);
		if (treemap.loading) {
		    console.log("already loading treemap data, refusing to respond to this click");
		    //TODO pop-up a warning to user that they need to wait! 
		    alert("Data load in progress, please try again in a moment!");
		    return;
		}
		if(_.size(child.child_dirs) > 0) {
		    fetchTreemapData(child, treemap, function() {
			console.log("new data loaded for child=", child);
			layout(child);
		    });

		    // regenerate color scale based on new layout
		    treemap.color = treemap.genColorScale(treemap.nodes, treemap.fillAccessor);

//		    console.log("before transition, treemap.root=", treemap.root)
		    transition(child);
//		    console.log("after transition, treemap.root=", treemap.root)
		} else {
		    console.log("no children for child=", child, " - not transitioning");
		}
	    });

	function tooltipText(d) {
	    // todo move template generation out
	    var text_template = _.template("<dl><% _.forEach(labels, function(label) { %><dt><%- label.key %></dt><dd><%- label.value %></dd><% }); %></dl>");
	    //		var text_template = _.template("Path: <%= path %>");
//TODO fixme for multiselect
	    var text_items = ["path", "size", "count", "ctime", "atime"]; //, sizeKey, fillKey];
	    var text_data = {
		"labels": _.map(text_items, function(item) {
		    //console.log("for item: ", item, " have key:", displayKey(item));
		    return {key: displayKey(item), value: displayValue(d, item)};
		}),
	    };
	    var text = text_template(text_data);
	    //console.log("generated tooltiptext for d:", d, " text: ", text);

	    return text;
	}

	function mouseover(g) {
	    //console.log("mouseover! path="+g.path);
	    d3.selectAll("div.tooltip").filter(function(d) {return d.path != g.path;})
		.html(tooltipText)
		.transition()
		.duration(500)
		.style("opacity", 1e-6);
	    d3.selectAll("div.tooltip").filter(function(d) {return d.path == g.path;})
		.html(tooltipText)
		.transition()
		.duration(500)
		.style("opacity", 1);
	}
	
	function mouseout() {
	    var div = d3.selectAll("div.tooltip");
	    div.transition()
		.duration(500)
		.style("opacity", 1e-6);
	}
	
	console.log("creating child rect for parent_and_children=", parent_and_children);
	parent_and_children.selectAll(".child")
	    .data(function(d) { return d.child_dirs || [d]; })
	    .enter().append("rect")
	    .classed("child", true)
	    .call(treebox)
	    .style("fill", fillColor);
	
	parent_and_children.append("rect")
	    .classed("parent", true)
	    .call(treebox)
	    .style("fill", fillColor);
	
	var titlesvg = parent_and_children.append("svg")
	    .classed("parent_title", true)
	    .attr("viewBox", "-100 -10 200 20")
	    .attr("preserveAspectRatio", "xMidYMid meet")
	    .call(treebox);

	titlesvg.append("text")
	    .attr("font-size", 16)
	    .attr("x", 0)
	    .attr("y", 0)
	    .attr("width", 200)
	    .attr("height", 20)
	    .attr("dy", ".3em")
	    .style("text-anchor", "middle")
	    .text(function(d) { return name(d); });
	
	d3.select("#selectSizeMetric").on("change", function() {
	    treemap.size.metric = this.value;
	    treemap.sizeAccessor = getValueAccessor(treemap.size);
	    console.log("sizeMetric changed to "+sizeMetric+ " treemap.sizeAccessor now ", treemap.sizeAccessor);
	    layout(treemap.root)
	    transition(node);
	});
	
	d3.select("#selectFillMetric").on("change", function() {
	    treemap.fill.metric = this.value;
	    treemap.fillAccessor = getValueAccessor(treemap.fill);
	    treemap.color = treemap.genColorScale(treemap.nodes, treemap.fillAccessor);
	    console.log("fillMetric changed to "+fillMetric+ " treemap.fillAccessor now ", treemap.fillAccessor);
	    layout(treemap.root)
	    transition(node);
	});
	return g1;
    }
    
    
    function transition(d) {
	//	    console.log("transition!");
	node = d;
	if (transitioning || !d) return;
	transitioning = true;
	
	var g2 = display(d),
        t1 = curg.transition().duration(750),
        t2 = g2.transition().duration(750);
	
	// Update the domain only after entering new elements.
	x.domain([d.x, d.x + d.dx]);
	y.domain([d.y, d.y + d.dy]);
	
	// Enable anti-aliasing during the transition.
	treemap.svg.style("shape-rendering", null);
	
	// Draw child nodes on top of parent nodes.
	treemap.svg.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });
	
	// Fade-in entering text.
	g2.selectAll("text").style("fill-opacity", 0);
	
	// Transition to the new view.
	t1.selectAll(".parent_title").call(treebox);
	t2.selectAll(".parent_title").call(treebox);
	t1.selectAll("text").style("fill-opacity", 0);
	t2.selectAll("text").style("fill-opacity", 1);
	t1.selectAll("rect").call(treebox).style("fill", fillColor);
	t2.selectAll("rect").call(treebox).style("fill", fillColor);

	// Remove the old node when the transition is finished.
	t1.remove().each("end", function(d) {
	    treemap.svg.style("shape-rendering", "crispEdges");
	    transitioning = false;
	    curg = g2;
	});
	
    }
    
    function textbox(text) {
	text.attr("x", function(d) { return x(d.x) + 6; })
	    .attr("y", function(d) { return y(d.y) + 6; });
    }
    
    function treebox(b) {
	b.attr("x", function(d) { 
	    //console.log("treebox: d.x=", d.x, " x(d.x)=", x(d.x), " d=", d);
	    return x(d.x); })
	    .attr("y", function(d) { return y(d.y); })
	    .attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
	    .attr("height", function(d) { return y(d.y + d.dy) - y(d.y); });
    }
    
    function name(d) {
	return d.name;
    }
    
    function path(d) {
	return d.path;
    }

    function tooltipId(d) {
	return "tooltip:"+path(d);
    }
    
    function depthId(d) {
	return "depth:"+path(d);
    }
    
    
    return treemap;
}); // treemap module

