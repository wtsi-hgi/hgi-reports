define(["d3", "lodash", "queue"], function(d3, _, queue) {
    console.log("treemap using d3 v"+d3.version+", underscore v"+_.VERSION+", queue v"+queue.version);

    var BINARY_UNIT_LABELS  = ["B","KiB","MiB","GiB","TiB","PiB","EiB","ZiB","YiB"];
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
	valueAccessors: {
	    count: function(d) {return 1;}
	},
    };
    
    var defaultSizeKey = "size";
    var defaultFillKey = "ctime_cost";
    
    var margin = {top: 20, right: 0, bottom: 20, left: 0},
    width = 960 - margin.right - margin.left,
    height = 500 - margin.top - margin.bottom,
    formatNumber = d3.format(",d"), 
    transitioning;
    
    var x = d3.scale.linear()
        .domain([0, width])
        .range([0, width]);
    
    var y = d3.scale.linear()
        .domain([0, height])
        .range([0, height]);
    
    var title = d3.select("#footer").insert("div", ":first-child");
    
    var node;

    var curg;

    var sizeKey = defaultSizeKey;
    var fillKey = defaultFillKey;
    
    var minmax = new Object();
    
    var getMinvalue = function() {
	console.log("getMinvalue returning min="+minmax.min);
	return minmax.min;
    }
    
    var getMaxvalue = function() {
	console.log("getMaxvalue returning max="+minmax.max);
	return minmax.max;
    }
    
    var colorGen = function() {
	// colors from colorbrewer2.org 5-class YlGnBu
	low =  "#ffffcc";
	lmid = "#a1dab4";
	mid =  "#41b6c4";
	hmid = "#2c7fb8";
	high = "#253494";

	var min = minmax.min;
	var max = minmax.max;
	if(min > 0) {
	    min = -1;
	}
	if(max < 0) {
	    max = 1;
	}
	return d3.scale.linear()
	    .interpolate(d3.interpolateHsl)
	    .domain([min, min/2, 0, max/2, max])
	    .range([low, lmid, mid, hmid, high]);
    }
    
    var fillColor = function(d) {
	if(!(fillKey in treemap.valueAccessors)) {
	    console.log("fillKey not in valueAccessors, defaulting to count");
	    fillKey = "count";
	}
	var color = colorGen();
	return color(treemap.valueAccessors[fillKey](d));
    }
    
    var sizeValue = function(d) {
	if(!(sizeKey in treemap.valueAccessors)) {
	    console.log("sizeKey not in valueAccessors, defaulting to count");
	    sizeKey = "count";
	}
	value=treemap.valueAccessors[sizeKey](d);
	//  console.log("sizeValue for d.name="+d.name+" using valueAccessor for "+sizeKey+" is "+value);
	if(!value) {
	    value = 0;
	    //    console.log("sizeValue not defined for d.name="+d.name+", setting to 0");
	}
	return value;
    }

    function displayKey(key) {
	return _.startCase(key)
    }

    function displayValue(d, key) {
	if(key in treemap.valueAccessors) {
	    value=treemap.valueAccessors[key](d);
	    if (/^size/.exec(key)) {
		bytes = d[key];
		return bytes_to_human_readable_string(bytes);
	    } else if(/_cost/.exec(key)) {
		cost = d[key];
		return "£" + cost.toFixed(2);
	    } else {
		return value;
	    }
	} else {
	    console.log("Could not find valueAccessor for key: ", key);
	    return "";
	}
    }

    var calcMinMax = function(nodes, f) {
	var myminmax = {};
	myminmax.min = d3.min(nodes, f);
	myminmax.max = d3.max(nodes, f);
	return myminmax;
    }
    
    treemap.layout = d3.layout.treemap()
	.children(function(d, depth) {return depth ? null : d.child_dirs; })
	.sort(function(a, b) {return a.value - b.value; })
	.ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
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
		} else if(error.status >= 500 && error.status < 600) {
		    console.log("Server error "+error.status+" (", error.statusText,"): ", error.responseText);
		    http_retries--;
		    if(http_retries > 0) {
			console.log("Retrying request for retry_d=", retry_d);
			fetchTreemapData(retry_d, treemap, onload_cb);
		    } else {
			console.log("No more retries! Giving up.");
			console.log("Should report this to user TODO!");
		    }
		} else if(error.status >= 400 && error.status < 500) {
		    console.log("Client error ("+error.status+" ", error.statusText,"): ", error.responseText);
		    console.log("Should print to page TODO!");
		} else if(error.status == 0) {
		    console.log("CORS error, possibly from shibboleth redirect?");
		    console.log(error.getAllResponseHeaders());
		    //TODO fix reload to take us back where we were
		    window.location.reload();
		} else {
		    console.log("Unexpected error ", error.readyState,  error.response, error.responseText, error.responseType, error.responseXML, error.status, error.statusText, error.timeout, error.withCredentials);
		    console.log(error.getAllResponseHeaders());
		    //TODO fix reload to take us back where we were
		    window.location.reload();
		}
	    } else {
		http_retries = HTTP_RETRY_COUNT;
		if(_.every(data, _.isObject) && data.length >= 1) {
		    if (_.isEmpty(treemap.root)) {
			var d = _(data).shift();
			console.log("treemap.root is empty: ", treemap.root, "setting to d:", d);
			treemap.root = d;
		    }
		    _.forEach(data, function(d) {
			console.log("merging d into treemap.root. d=", d);
			treemap.root = mergeLustreTree(treemap.root, d);
		    });
		    
		    //initialDataLoad();
		    var result = _.attempt(onload_cb);

		    if (_.isError(result)) {
			console.log("Error invoking onload_cb: ", onload_cb);
		    }
		    
		} else {
		    console.log("queue completed but data missing. have data=", data);
		}
	    }
	});
    }

    function fetchTreemapData(d, treemap, load_callback) {
	//console.log("fetchTreemapData d=", d, "treemap.root=", treemap.root)
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

	//console.log("mergeLustreTree: subtree merge of y.path=", y.path, " into subtree.path=", subtree.path);
	_.merge(subtree, y, function(a, b, k, o, s) {
	    if (_.isUndefined(a)) {
		return b;
	    } else if (_.isUndefined(b)) {
		return a;
	    } else if(_.isString(a) && _.isString(b)) {
		if(a == b) {
		    return a;
		} else {
		    console.log("mergeLustreTree: ERROR, strings not equal for k=", k, " a=", a, " b=", b, ", returning b");
		    //		    return a.concat(b);
		    return b;
		}
	    } else if(_.isNumber(a) && _.isNumber(b)) {
		if(a == b) {
		    return a;
		} else {
		    if(subtree.path == o.path && subtree.path == s.path) {
			return a+b;
		    } else {
			console.log("mergeLustreTree: ERROR, numbers not equal for k=", k, " a=", a, " b=", b, " o=", o, " s=", s, ", returning b");
		    }
		}
	    } else if(k == "child_dirs") {
		if(_.isArray(a) && _.isArray(b)) {
		    return mergeChildren(a, b);
		} else {
		    console.log("mergeLustreTree: ERROR, have child_dirs but one is unexpectedly not an array. a=", a, " b=", b);
		}
	    } else {
		console.log("mergeLustreTree: ERROR, encountered unexpected property k=", k, " a=", a, " b=", b);
		return undefined;
	    }
	});
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

    function initialDataLoad() {
	console.log("initialDataLoad: have treemap=", treemap);

	// set title text
	title.text("Humgen Lustre");
	
	// set size and color options
	_.each(treemap.root, function(value, key){
	    treemap.valueAccessors[key] = function(d) { 
		if( _.isObject(d) && _.has(d, key)) { 
		    return d[key]; 
		} else { 
		    return undefined; 
		} 
	    } 
	    if(_.isNumber(value)){ 
		d3.select("#selectSize").insert("option").attr("value",key).attr("id","size_"+key).text(key);
		d3.select("#selectFill").insert("option").attr("value",key).attr("id","fill_"+key).text(key);
	    }
	});
	
	// set selected property on default option
	d3.select("#size_"+sizeKey).attr("selected",1);
	d3.select("#fill_"+fillKey).attr("selected",1);
	
	initialize(treemap.root);
	accumulate(treemap.root);
	layout(treemap.root);
	curg = display(treemap.root);
	if (_.isUndefined(node)) {
	    console.log("setting node to treemap.root");
	    node = treemap.root;
	}
    }
	
    function initialize(root) {
	root.x = root.y = 0;
	root.dx = width;
	root.dy = height;
	root.depth = 0;
    }
    
    // Aggregate the values for internal nodes. This is normally done by the
    // treemap layout, but not here because of our custom implementation.
    // We also take a snapshot of the original children (_children) to avoid
    // the children being overwritten when when layout is computed.
    function accumulate(d) {
	if (d.child_dirs) {
	    d.child_dirs.forEach(function(c) {accumulate(c)});
	    d.value = sizeValue(d);
	} else {
	    d.value = sizeValue(d);
	}
	return d.value;
    }
    
    // Compute the treemap layout recursively such that each group of siblings
    // uses the same size (1×1) rather than the dimensions of the parent cell.
    // This optimizes the layout for the current zoom state. Note that a wrapper
    // object is created for the parent node for each group of siblings so that
    // the parent’s dimensions are not discarded as we recurse. Since each group
    // of sibling was laid out in 1×1, we must rescale to fit using absolute
    // coordinates. This lets us use a viewport to zoom.
    function layout(d) {
	if (d.child_dirs) {
	    var childNodes = treemap.layout.nodes({child_dirs: d.child_dirs});
	    treemap.nodes.push(childNodes);
	    d.child_dirs.forEach(function(c) {
		c.x = d.x + c.x * d.dx;
		c.y = d.y + c.y * d.dy;
		c.dx *= d.dx;
		c.dy *= d.dy;
		c.parent = d;
		layout(c);
	    });
	}
	treemap.nodes = _.flatten(treemap.nodes);
    }
    
    function display(d) {
	treemap.grandparent
	    .datum(d.parent)
	    .on("click", function(d) {
		console.log("clicked grandparent=", d);
		if(!_.isUndefined(d)) {
		    //console.log("grandparent clicked d.path="+d.path);
		    transition(d);
		}
	    })
	    .select("text")
	    .text(path(d));
	
	minmax = calcMinMax(treemap.nodes, treemap.valueAccessors[fillKey]);
	
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
		if(_.size(child.child_dirs) > 0) {
		    fetchTreemapData(child, treemap, function() {
			console.log("new data loaded for child=", child);
			accumulate(child);
			layout(child);
		    });
		    transition(child);
		} else {
		    console.log("no children for child=", child, " - not transitioning");
		}
	    });

	function tooltipText(d) {
	    // todo move template generation out
	    var text_template = _.template("<dl><% _.forEach(labels, function(label) { %><dt><%- label.key %></dt><dd><%- label.value %></dd><% }); %></dl>");
	    //		var text_template = _.template("Path: <%= path %>");

	    var text_items = ["path", sizeKey, fillKey];
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
	
	d3.select("#selectSize").on("change", function() {
	    sizeKey = this.value;
	    console.log("sizeKey changed to "+sizeKey);
	    accumulate(treemap.root);
	    layout(treemap.root)
	    transition(node);
	});
	
	d3.select("#selectFill").on("change", function() {
	    fillKey = this.value;
	    console.log("fillKey changed to "+fillKey);
	    accumulate(treemap.root);
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
	b.attr("x", function(d) { return x(d.x); })
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

