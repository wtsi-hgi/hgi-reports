require.config({
    paths: {
	d3: "d3.v3",
    }
});

require(["treemap"],
	function(treemap) {
	    console.log("treemap loaded");
	}
       );
