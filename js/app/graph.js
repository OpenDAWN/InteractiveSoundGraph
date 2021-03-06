var APP = APP || {};

APP.graph = (function startGraph() {

	// "constants"; do not change during following code
	var LOOP_DURATION = 500;
	var NODE_FILL = "green";
	var NODE_FILL_HIGHLIGHT = "white";

	// module object; add all methods and properties that should be visible globally
	var module = {};

	// this does not seem to be used?
	module.play_flag = false;
	
	// all nodes that will be played in the current step
	var nextNodesArray = [];
	// all nodes that will be appended to the above array after the next play interval
	var appendToNextNodesArray = [];
	
	// the currently selected (and graphically highlighted) node
	var curr_node = undefined;

	// dimensions of the svg element
	var width = window.innerWidth - 20;
	var height = window.innerHeight - 76;

	var force = d3.layout.force()
		.size([width, height])
		//.nodes([]) // save-reload method should pass saved nodes here (--> the argument of the startGraph method?)
		.linkDistance(45).charge(-60).on("tick", tick);

	var svg = d3.select("body")
		.append("svg")
		.attr("width", width)
		.attr("height", height)
		.on("mousemove", mousemove)
		.on("mousedown", mousedown);
		
		d3.select(window).on("keydown", keyDown);

	svg.append("rect")
		.attr("width", width)
		.attr("height", height);

	// array which holds ALL nodes
	var nodes = force.nodes(),
		startNodes = [],
		links = force.links(), 
		node = svg.selectAll(".node"), 
		link = svg.selectAll(".link");
	
	// the 'cursor' --> circle to select the nodes you want to make a connection to
	var cursor = svg.append("circle")
		.attr("r", 30)
		.attr("transform", "translate(-100,-100)")
		.attr("class", "cursor");
		
		restart();

	function mousemove() {
		cursor.attr("transform", "translate(" + d3.mouse(this) + ")");
	}

	// why make links available globally?
	module.links = links;

	//Load and Save Logic
	function saveGraph() {
		saved_nodes = [];
		saved_links = [];
		nodes.forEach(function(node) {
			saved_nodes.push( {
			    index: node.index,
				x : node.xStart, 
				y : node.yStart,
				name: node.name,
				group_name: node.group_name,
				color : node.color,
			});
		});
		links.forEach(function(link) {
			saved_links.push( {
				source: link.source.index,
				target: link.target.index,
				});
		});
		localStorage["test"] = JSON.stringify({'nodes': saved_nodes, 'links': saved_links});
		return saved_nodes;
	}
	
	var load_node = function(node) {
			new_node = { 
				index: node.index,
				x :  node.x,
				y : node.y,
				xStart :  node.x,
				yStart : node.y,
				name : node.name,
				group_name : node.group_name,
				sound : APP.Sound.getSoundObject(node.group_name, node.name),
				color : node.color,
				previousNode : undefined, 
				d3circleReference : undefined
				};
			addNode(new_node);
		}
	
	function loadGraph() {
		var jsonData = JSON.parse(localStorage["test"]);
		var index = 0;
		
			loadNextNode();

		function loadNextNode(){
			if (index < jsonData['nodes'].length) {
				load_node( jsonData['nodes'][index]);
				index++;
				setTimeout(loadNextNode, 500);	
			}
			else {
				//set links
				links = [];
				jsonData['links'].forEach(function(link) {
					links.push({source : nodes[link.source], 
									target : nodes[link.target]});
				});
			restart();
			}
		}
	}
	module.save = saveGraph;
	module.load = loadGraph;
	
	// static id counter, is used to generate unique integer ids (called 'index')
	var idx = 0;

	// creates a new node object at the given point with a unique id
	function newNode(point){
		new_node = { 	
			index : idx,
			// current node position
			x : point[0],
			y : point[1],
			// the point of insertion
			xStart : point[0],
			yStart : point[1],
			name : APP.Sound.currentSelection["sampleName"],
			group_name:  APP.Sound.currentSelection["groupName"],
			sound : APP.Sound.getNewSoundObjectForCurrentSound(),
			color : APP.Sound.getFillColorForCurrentSound(),
			previousNode : undefined,
			d3circleReference : undefined
		};
		idx += 1;
		curr_node = new_node
		return new_node;
	}
	
	function mousedown() {
		var point = d3.mouse(this), 
			node = newNode(point); 	
			addNode(node);
	}

	// adds a new node and its connections to all relevant arrays
	function addNode(node){
			n = nodes.push(node);
		var isNewNodeConnected = false;
		
		// add links to any nearby nodes
		nodes.forEach(function(target) {
			if (! (node.index == target.index) ) {
				var x = target.x - node.x, y = target.y - node.y;
				if (Math.sqrt(x * x + y * y) < 30) {
					links.push({source : node, target : target});
					isNewNodeConnected = true;
				}
			}
			
		});
		// if there is no connection to other nodes add the node to the array of nodes to play next
		if (!isNewNodeConnected) {
			if (!module.playLoop) {
				// when loop is not playing, just push the new node to the nextNodesArray
				nextNodesArray.push(node);
			}
			else {
				// loop is playing; push the new node to an array that will be appended to nextNodesArray after the next play interval
				appendToNextNodesArray.push(node);
			}
		}
		restart();
	}

	function tick() {
		try {
		link.attr("x1", function(d) {return d.source.x;})
			.attr("y1", function(d) {return d.source.y;})
			.attr("x2", function(d) {return d.target.x;})
			.attr("y2", function(d) {return d.target.y;});
		node.attr("cx", function(d) {return d.x;})
			.attr("cy", function(d) {return d.y;})
			.attr("style",  function(d) {return d.fill;});
		}
		catch (err) {
			// an error can occur here when clear button is pressed shortly after loop has stopped
			console.log("tick error");
		}
	}

	// show sound name on hover
	function nodeHoverInHandler (node) {
		$('#soundNameField').fadeIn();
		$('#soundNameField').css("color", node.color);
		$('#soundName').text(node.name);
	}

	function nodeHoverOutHandler(node) {
		$('#soundNameField').fadeOut();
	}

	function nodeClickHandler(node) {
		console.log(node.index);
		curr_node = node;
		restart();
	}
	
	function linkClickHandler(link) {
		curr_link = link;
		// TODO change link color
		restart();
	}
	
	function spliceLinksForNode(node) {
	  toSplice = links.filter(
		function(l) { 
		  return (l.source === node) || (l.target === node); });
	  toSplice.map(
		function(l) {
		  links.splice(links.indexOf(l), 1); });
	}
	
	function keyDown() {	
		switch (d3.event.keyCode) {
			case 8: // backspace
			case 46: { // delete
				 if (curr_node) {
					nodes.splice(nodes.indexOf(curr_node), 1);
					spliceLinksForNode(curr_node);
				  }
				  else if (curr_link) {
					links.splice(links.indexOf(curr_link), 1);
				  }
				  curr_link = null;
				  curr_node = null;
				  restart();
			}
			case 13 : {
				curr_node.name = APP.Sound.currentSelection["sampleName"];
				curr_node.sound = APP.Sound.getNewSoundObjectForCurrentSound();
				curr_node.color = APP.Sound.getFillColorForCurrentSound();
				restart();
			}
		}	
	}
	
	// restarts the d3 force layout
	// is called every time a change to the graph is made (?)
	function restart() {
		//link = link.data(links);
		link = link.data(force.links(), function( d) {
			return links.indexOf( d);
		});
		
		link.enter().insert("line", ".node").attr("class", "link")
			.on("mousedown", linkClickHandler);
		link.exit().remove();
		//node = node.data(nodes);
		node = node.data(force.nodes(), function( d) {
			return nodes.indexOf( d);
		});
		
		node.enter().insert("circle", ".cursor").attr("class", "node").attr("r", 7)
			.on("mouseover", nodeHoverInHandler)
			.on("mouseout", nodeHoverOutHandler)
			.on("mousedown", nodeClickHandler)
			.call(force.drag);
		node.exit().transition()
				.attr("r", 0)
				.remove();
		
		// traverse nodes array and push to each node a reference to the corresponding d3 circle
		nodes.forEach(function (currentNode, index) {
			currentNode.d3circleReference = node[0][index];
			if (currentNode.name == "pause") {
				d3.select(currentNode.d3circleReference).attr("stroke", currentNode.color).attr("stroke-width", 2);
				d3.select(currentNode.d3circleReference).attr("fill", "black");
			}
			else {
				d3.select(currentNode.d3circleReference).attr("stroke", currentNode.color).attr("stroke-width", 2);
				
				if(curr_node && currentNode.index != curr_node.index) {
					d3.select(currentNode.d3circleReference).attr("fill", currentNode.color);
				}
			}
			
			if(curr_node && currentNode.index == curr_node.index) {
				d3.select(currentNode.d3circleReference).attr("stroke", currentNode.color).attr("stroke-width", 2);
				d3.select(currentNode.d3circleReference).attr("fill", "red");
			}
			
		});
		force.start();
	}
	
	// clear the svg content from the graph, restart graph
	function clear() {
		d3.select("svg").remove();
		// stop loop
		clearInterval(module.interval);
		node = [];
		nodes = [];
		nextNodesArray = [];
		appendToNextNodesArray = [];
		APP.graph = startGraph();
	}
	
	var traverseGraph = function () {
		// array to collect the nodes that will be played in the next step
		var nextStepNodesArray = [];

		nextNodesArray.forEach(function (currentNode, index) {

			// first play sound
			if (APP.Sound.isSoundOn) {
				if (!currentNode.sound.isEnded()) {
					currentNode.sound.stop();	
				}
				currentNode.sound.play();
			}
			// then highlight node
			var color = currentNode.color;
			if (currentNode.name == "pause") color = "black";
			if (curr_node && currentNode.index == curr_node.index) color = "red";
			
			// node[0] gets array of d3 circles
			d3.select(currentNode.d3circleReference).attr("fill", NODE_FILL_HIGHLIGHT).transition()
				.attr("fill", color).transition();

			// run through the link array one first time to determine if the current node has more than one connection
			var currentNodeHasConnection = false;
			var currentNodeHasMoreThanOneConnection = false;
			$(links).each(function (index, link) {
				// check if one of the nodes in the edge is the current node
				if (link.source == currentNode || link.target == currentNode) {
					if (currentNodeHasConnection) {
						currentNodeHasMoreThanOneConnection = true;
						return false;
					}
					else {
						currentNodeHasConnection = true;
					}
				}
			});

			// if the node has no connection at all, re-insert him to the nodesToPlay array
			if (!currentNodeHasConnection) {
				nextStepNodesArray.push(currentNode);
			}
			else {
				// otherwise check for connections to other nodes and collect nodes for the next step
				links.forEach(function (link) {
					// check if one of the nodes in the edge is the current node
					if (link.source == currentNode) {
						// check if the linked node is the same as previous node, in this case only add it if it's the only connection of the current node
						if (link.target == currentNode.previousNode) {
							if (!currentNodeHasMoreThanOneConnection) {
								// push node
								nextStepNodesArray.push(link.target);
								link.target.previousNode = currentNode;
							}
						}
						else {
							// push node
							nextStepNodesArray.push(link.target);
							link.target.previousNode = currentNode;
						}
					}
					else if (link.target == currentNode) {
						// check if the linked node is the same as previous node, in this case only add it if it's the only connection of the current node
						if (link.source == currentNode.previousNode) {
							if (!currentNodeHasMoreThanOneConnection) {
								// push node
								nextStepNodesArray.push(link.source);
								link.source.previousNode = currentNode;
							}
						}
						else {
							// push node
							nextStepNodesArray.push(link.source);
							link.source.previousNode = currentNode;
						}
					}
				});
			}
		});

		// append possibly newly entered nodes to the nodes to play array
		appendToNextNodesArray.forEach(function (nodeToAppend) {
			nextStepNodesArray.push(nodeToAppend);
		});
		appendToNextNodesArray = [];

		nextNodesArray = [];
		// eliminate duplicates
		nextStepNodesArray.forEach(function (currentNode, index) {
			if($.inArray(currentNode, nextNodesArray) == -1) {
				nextNodesArray.push(currentNode);
			}
		});
	}
	
	function setLoopDuration (d){
		LOOP_DURATION = d;
		toggleLoop();
		toggleLoop();
	};
	
	var toggleLoop = function(){

		module.playLoop = !module.playLoop;

		// TO DO: if nodes.length == 0 show message 'insert nodes first' and leave the switch untoggled
		if (module.playLoop && nodes.length > 0) {
			// 
			module.interval = setInterval(function () {
				// traverse our graph
				restart();
				traverseGraph();
	
			}, LOOP_DURATION);
		}
		else {
			// if loop turned off, clear loop
			clearInterval(module.interval);
		}
	}

	module.setLoopDuration = setLoopDuration;
	module.toggleLoop = toggleLoop;
	module.clear = clear;
	return module;
})();