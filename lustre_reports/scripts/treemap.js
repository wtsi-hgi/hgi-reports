define(["d3", "lodash"], function(d3, _) {
    console.log("treemap using d3 v"+d3.version+" and underscore v"+_.VERSION);
    var treemap = new Object();

    //defaultFillKey = "ctime_cost";
    //defaultSizeKey = "size";
    defaultSizeKey = "ctime_cost";
    defaultFillKey = "atime_cost";
    
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
    
    var nodes = new Array();
    
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

    var data_113;
    var data_114;
    d3.json("../api/lustretree/scratch113?depth=3&path=/lustre")
	.on("error", function(error) { 
	    console.log("failure getting json data", error); 
	})
	.on("load", function(data) {
	    data_113 = data;
	    if(data_113 && data_114)
		initialDataLoad();
	})
	.get();
    
    d3.json("../api/lustretree/scratch114?depth=3&path=/lustre")
	.on("error", function(error) { 
	    console.log("failure getting json data", error); 
	})
	.on("load", function(data) {
	    data_114 = data;
	    if(data_113 && data_114)
		initialDataLoad();
	})
	.get();
    

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

    function initialDataLoad() {
	treemap.root = mergeLustreTree(data_113, data_114);

	// set title text
	title.text("Lustre");
	
	// set size and color options
	_.each(treemap.root, function(value, key){if(_.isNumber(value)){ valueAccessors[key] = function(d) { if( _.isObject(d) && _.has(d, key)) { return d[key]; } else { return undefined; } } }});
	_.each(treemap.root, function(value, key){if(_.isNumber(value)){ d3.select("#selectSize").insert("option").attr("value",key).attr("id","size_"+key).text(key) }});
	_.each(treemap.root, function(value, key){if(_.isNumber(value)){ d3.select("#selectFill").insert("option").attr("value",key).attr("id","fill_"+key).text(key) }});
	
	// set selected property on default option
	d3.select("#size_"+sizeKey).attr("selected",1);
	d3.select("#fill_"+fillKey).attr("selected",1);
	
	initialize(treemap.root);
	accumulate(treemap.root);
	layout(treemap.root);
	var curg = display(treemap.root);
	node = treemap.root;
	
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
	
	function display(d) {
	    grandparent
		.datum(d.parent)
		.on("click", function(d) {
		    console.log("grandparent clicked d.path="+d.path);
		    transition(d);
		})
		.select("text")
		.text(path(d));
	    
	    minmax = calcMinMax(nodes, valueAccessors[fillKey]);
	    
	    var g1 = svg.insert("g", ".grandparent")
            .datum(d)
		.attr("class", "depth");
	    
	    var g = g1.selectAll("g")
		.data(d._children)
		.enter().append("g");
	    
	    g.filter(function(d) { return d._children; })
		.classed("children", true)
		.on("click", function(d) {
		    console.log("clicked on d.path="+d.path);
		    //		console.log("loading d.path="+d.path);
		    //		d3.json("../api/lustretree/scratch113?depth=3&path="+d.path)
		    //		    .on("error", function(error) { 
		    //			console.log("failure getting json data", error); 
		    //		    })
		    //		    .on("load", function(data) {
		    //			console.log("setting d to data");
		    //			d = data;
		    //		    node = root = d = data; 
		    //		    accumulate(d);
		    //		    layout(d);
		    //		    display(d);
		    //		})
		    //		    .get();
		    
		    transition(d);
		});
	    
	    g.selectAll(".child")
		.data(function(d) { return d._children || [d]; })
		.enter().append("rect")
		.attr("class", "child")
		.call(rect);
	    
	    g.append("rect")
		.attr("class", "parent")
		.call(rect)
		.append("title")
		.text(function(d) { return formatNumber(d.value); });
	    
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
	    console.log("transition!");
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
		console.log("remove!");
		console.log(d);
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

