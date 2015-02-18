define(["d3", "lodash", "queue"], function(d3, _, queue) {
    console.log("treemap using d3 v"+d3.version+", underscore v"+_.VERSION+", queue v"+queue.version);

    var BINARY_UNIT_LABELS  = ["B","KiB","MiB","GiB","TiB","PiB","EiB","ZiB","YiB"];
    var HUMAN_TRIGGER_RATIO = 0.8;
    var OUTPUT_UNIT_SEP = " ";

    var treemap = new Object();

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
    
    var nodes;
    var node;
    
    var sizeKey = defaultSizeKey;
    var fillKey = defaultFillKey;
    
    var valueAccessors = {
	count: function(d) {return 1;}
    };
    
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
	//  low = "red";
	//  mid = "#eeeeee";
	//  high = "blue";
	// colors from colorbrewer2.org 5-class RdYlBu
	low = "#d7191c";
	lmid = "#fdae61";
	mid = "#ffffbf";
	hmid = "#abd9e9";
	high = "#2c7bb6";
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
	//    .domain([min, ((max-min)/2)+min, max])
	//    .range([low, mid, high]);
	//    .domain([min, 0, max])
	//    .range([low, mid, high]);
	    .domain([min, min/2, 0, max/2, max])
	    .range([low, lmid, mid, hmid, high]);
    }
    
    var fillColor = function(d) {
	if(!(fillKey in valueAccessors)) {
	    console.log("fillKey not in valueAccessors, defaulting to count");
	    fillKey = "count";
	}
	var color = colorGen();
	return color(valueAccessors[fillKey](d));
    }
    
    var sizeValue = function(d) {
	if(!(sizeKey in valueAccessors)) {
	    console.log("sizeKey not in valueAccessors, defaulting to count");
	    sizeKey = "count";
	}
	value=valueAccessors[sizeKey](d);
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
	if(key in valueAccessors) {
	    value=valueAccessors[key](d);
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
    
    var treemap_layout = d3.layout.treemap()
	.children(function(d, depth) {return depth ? null : d._children; })
	.sort(function(a, b) {return a.value - b.value; })
	.ratio(height / width * 0.5 * (1 + Math.sqrt(5)))
	.round(false);
    
    var svg = d3.select("#chart").append("svg")
	.attr("width", width + margin.left + margin.right)
	.attr("height", height + margin.bottom + margin.top)
	.style("margin-left", -margin.left + "px")
	.style("margin.right", -margin.right + "px")
	.append("g")
	.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
	.style("shape-rendering", "crispEdges");
    
    var grandparent = svg.append("g")
	.attr("class", "grandparent");
    
    grandparent.append("rect")
	.attr("y", -margin.top)
	.attr("width", width)
	.attr("height", margin.top);
    
    grandparent.append("text")
	.attr("x", 6)
	.attr("y", 6 - margin.top)
	.attr("dy", ".75em");

    var path_data_url_templates = {
	"/lustre/scratch113": _.template("../api/lustretree/scratch113?depth=3&path=<%= path %>"),
	"/lustre/scratch114": _.template("../api/lustretree/scratch114?depth=3&path=<%= path %>"),
    }

    var q = queue()
    _.forEach(path_data_url_templates, function(n, key) {
	url = path_data_url_templates[key]({path: "/lustre"})
	console.log("adding defer for retrieval of "+key+": "+url);
	q.defer(d3.json, url);
    });
    q.await(function() {
	error = _(arguments).shift();
	data = arguments;
	if(error) {
	    console.log("failure getting json data", error); 
	} else {
	    if(_.every(data, _.isObject)) {
		if(data.length >= 1) {
		    var d = _(data).shift();
		    console.log("setting initial treemap.root to:", d);
		    treemap.root = d;
		} 
		_.forEach(data, function(d) {
		    console.log("merging data into treemap.root:", d);
		    treemap.root = mergeLustreTree(treemap.root, d);
		});
		initialDataLoad();
	    } else {
		console.log("queue completed but data missing. have data=");
		console.log(data);
	    }
	}
    });
    
    function mergeLustreTree(x, y) {
	var merged = x;
	_.merge(merged, y, function(a, b, k, o, s) {
	    if (_.isUndefined(a)) {
		return b;
	    } else if (_.isUndefined(b)) {
		return a;
	    } else if(_.isString(a)) {
		if(a == b) {
		    return a;
		} else {
		    return a.concat(b);
		}
	    } else if(_.isNumber(a)) {
		return a+b;
	    } else if(_.isArray(a) && k == "children") {
		return mergeChildren(a, b);
	    } else {
		console.log("mergeLustreTree encountered unexpected property k="+k);
		console.log(a);
		console.log(b);
		return undefined;
	    }
	});
	return merged;
    }

    function mergeChildren(x, y) {
	xpaths = _.map(x, function(a) {return a.path});
	ypaths = _.map(y, function(a) {return a.path});
	sharedpaths = _.intersection(xpaths, ypaths);
	if (_.size(sharedpaths) > 0 && !_.isUndefined(sharedpaths[0])) {
	    console.log("mergeChildren refusing to continue with sharedpaths length "+_.size(sharedpaths));
	    return undefined;
	} else {
	    return x.concat(y);
	}
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

	// set title text
	title.text("Humgen Lustre");
	
	// set size and color options
	_.each(treemap.root, function(value, key){
	    valueAccessors[key] = function(d) { 
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
	var curg = display(treemap.root);
	node = treemap.root;
	
	function initialize(root) {
	    nodes = new Array();
    
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
	    //    return (d._children = d.children)
	    //        ? d.value = d.children.reduce(function(p, v) { return p + accumulate(v); }, 0)
	    //        : d.value = sizeValue(d);
	    if (!d._children) {
		d._children = d.children;
	    }
	    if (d._children) {
		//	console.log("accumulate: accumulating children of d.name="+d.name)
		//        d.value = d.children.reduce(function(p, v) { return p + accumulate(v); }, 0);
		//	console.log("accumulate: accumulated total for d.name="+d.name+" is "+d.value);
		d._children.forEach(function(c) {accumulate(c)});
		d.value = sizeValue(d);
	    } else {
		//	console.log("accumulate: d.name="+d.name+" has no children");
		d.value = sizeValue(d);
		//	console.log("accumulate: value for d.name="+d.name+" is "+d.value);
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
	    if (d._children) {
		var childNodes = treemap_layout.nodes({_children: d._children});
		nodes.push(childNodes);
		d._children.forEach(function(c) {
		    c.x = d.x + c.x * d.dx;
		    c.y = d.y + c.y * d.dy;
		    c.dx *= d.dx;
		    c.dy *= d.dy;
		    c.parent = d;
		    layout(c);
		});
	    }
	    nodes = _.flatten(nodes);
	}
	
	function tooltipId(d) {
	    return "tooltip:"+path(d);
	}
	
	function display(d) {
	    grandparent
		.datum(d.parent)
		.on("click", function(d) {
		    if(!_.isUndefined(d)) {
			//console.log("grandparent clicked d.path="+d.path);
			transition(d);
		    }
		})
		.select("text")
		.text(path(d));
	    
	    minmax = calcMinMax(nodes, valueAccessors[fillKey]);
	    
	    var g1 = svg.insert("g", ".grandparent")
            .datum(d)
		.attr("class", "depth");
	    
	    var div = d3.select("body").selectAll("div.tooltip")
		.data(d._children, path);
	    div.exit().remove();
	    div.enter().append("div")
	        .attr("id", tooltipId)
		.attr("class", "tooltip")
		.style("opacity", 1e-6)
		.html(tooltipText);
	    
	    var g = g1.selectAll("g")
		.data(d._children)
		.enter().append("g");
	    
	    g.on("mouseover", mouseover)
		.on("mousemove", mousemove)
		.on("mouseout", mouseout);
	    

	    g.filter(function(d) { return d._children; })
		.classed("children", true)
	        // .on("mouseenter", function(d) {
		//     console.log("mouse over d:", d);
		// })
	        // .on("mouseleave", function(d) {
		//     console.log("mouse left d:", d);
		// })
		.on("click", function(d) {
		    var q = queue()
		    _.forEach(path_data_url_templates, function(n, path) {
			if(_.startsWith(d.path, path)) {
			    url = path_data_url_templates[path](d);
			    q.defer(d3.json, url);
			}
		    });
		    q.await(function(error) {
			data = arguments;
			if(error) {
			    console.log("failure getting json data", error); 
			} else {
			    if(_.every(data)) {
				if(data.length==2) {
				    //treemap.root = mergeLustreTree(data[0], data[1]);
				//		    	    d = data;
				//		    node = root = d = data; 
				//		    accumulate(d);
		    //		    layout(d);
				//		    display(d);
				} else {
				    console.log("queue completed but data missing. have data="+data);
				}
			    }
			}
		    });
		    
		    transition(d);
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
		    .transition()
		    .duration(500)
		    .style("opacity", 1e-6);
		d3.selectAll("div.tooltip").filter(function(d) {return d.path == g.path;})
		    .transition()
		    .duration(500)
		    .style("opacity", 1);
	    }
	
	    function mousemove(g) {
		d3.selectAll("div.tooltip").filter(function(d) {return d.path == g.path;})
		    .style("left", (d3.event.pageX - 34) + "px")
		    .style("top", (d3.event.pageY - 12) + "px");
	    }
	    
	    function mouseout() {
		var div = d3.selectAll("div.tooltip");
		div.transition()
		    .duration(500)
		    .style("opacity", 1e-6);
	    }
	    
	    g.selectAll(".child")
		.data(function(d) { return d._children || [d]; })
		.enter().append("rect")
		.attr("class", "child")
		.call(rect);
	    
	    g.append("rect")
		.attr("class", "parent")
		.call(rect)
//		.append("title")
//		.text(function(d) { return formatNumber(d.value); });
	    
	    g.append("text")
		.attr("dy", ".75em")
		.text(function(d) { return name(d); })
		.call(text);
	    
	    d3.select("#selectSize").on("change", function() {
		sizeKey = this.value;
		console.log("sizeKey now "+sizeKey);
		initialize(treemap.root);
		accumulate(treemap.root);
		layout(node);
		curg = display(node);
		transition(node);
	    });
	    
	    d3.select("#selectFill").on("change", function() {
		fillKey = this.value;
		console.log("fillKey now "+fillKey);
		curg = display(node);
		//    transition(node);
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
	    svg.style("shape-rendering", null);
	    
	    // Draw child nodes on top of parent nodes.
	    svg.selectAll(".depth").sort(function(a, b) { return a.depth - b.depth; });
	    
	    // Fade-in entering text.
	    g2.selectAll("text").style("fill-opacity", 0);
	    
	    // Transition to the new view.
	    t1.selectAll("text").call(text).style("fill-opacity", 0);
	    t2.selectAll("text").call(text).style("fill-opacity", 1);
	    t1.selectAll("rect").call(rect);
	    t2.selectAll("rect").call(rect);
	    
	    // Remove the old node when the transition is finished.
	    t1.remove().each("end", function(d) {
//		console.log("remove!");
//		console.log(d);
		svg.style("shape-rendering", "crispEdges");
		transitioning = false;
		curg = g2;
	    });
	    
	}
	
	function text(text) {
	    text.attr("x", function(d) { return x(d.x) + 6; })
		.attr("y", function(d) { return y(d.y) + 6; });
	}
	
	function rect(rect) {
	    rect.attr("x", function(d) { return x(d.x); })
		.attr("y", function(d) { return y(d.y); })
		.attr("width", function(d) { return x(d.x + d.dx) - x(d.x); })
		.attr("height", function(d) { return y(d.y + d.dy) - y(d.y); })
		.style("fill", fillColor);
	}
	
	function name(d) {
	    //    return d.parent
	    //        ? name(d.parent) + "/" + d.name
	    //        : "/" + d.name;
	    return d.name;
	}
	
	function path(d) {
	    return d.path;
	}
	
    }
       
    treemap.nodes = nodes;
    treemap.layout = treemap_layout;
    treemap.svg = svg;
    treemap.grandparent = grandparent;
    treemap.valueAccessors = valueAccessors;
    return treemap;

});

