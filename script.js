// 1. Setup the dimensions and margins for our diagram
const margin = {top: 20, right: 90, bottom: 30, left: 90};
const width = 960 - margin.left - margin.right;
const height = 500 - margin.top - margin.bottom;

// A color palette for our categories
const categoryColors = {
    "Fruits": "#10b981", // Emerald Green
    "Toys": "#8b5cf6",   // Violet Purple
    "Default": "#3b82f6" // Blue for everything else
};

// 2. Append the svg object to our 'tree-container' with zoom functionality
const svg = d3.select("#tree-container").append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .call(d3.zoom().on("zoom", (event) => {
        g.attr("transform", `translate(${event.transform.x + margin.left},${event.transform.y + margin.top}) scale(${event.transform.k})`); // This makes it zoom and pan!
    }));

// This 'g' is the actual container that will move
const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 3. Create the tree layout
const treeLayout = d3.tree().size([height, width]);

// 1. Load the Data and Draw 🚀
let root; // This will hold our data "tree"
let i = 0; // A counter to give every node a unique ID

// Load our JSON map
d3.json("hierarchy_data.json").then(data => {
    // Assigns parent, children, height, depth
    root = d3.hierarchy(data, d => d.children);
    root.x0 = height / 2; // Starting point (middle of the screen)
    root.y0 = 0;

    // Start by closing all the branches! 
    // If you want them open at start, delete the next line.
    if (root.children) {
        root.children.forEach(collapse);
    }

    update(root); // Run the function to draw everything
}).catch(error => {
    console.error("Error loading JSON:", error);
    // Show error message on page
    d3.select("#tree-container")
        .append("div")
        .style("color", "red")
        .style("padding", "20px")
        .html(`<h2>Error loading data</h2><p>${error.message}</p><p>Make sure hierarchy_data.json exists in the same folder.</p>`);
});

// This function hides the children when you click
function collapse(d) {
    if (d.children) {
        d._children = d.children; // Save children here
        d._children.forEach(collapse);
        d.children = null; // Hide them
    }
}

// 2. Add the "Update" Function 🔄
function update(source) {
    // Recalculate the tree layout
    treeLayout(root);
    
    const nodes = root.descendants();
    const links = root.links();

    // Normalize for fixed-depth (spreads the branches out)
    nodes.forEach(d => { d.y = d.depth * 180; });

    // --- NODES (The Circles) ---
    const node = g.selectAll('g.node')
        .data(nodes, d => d.id || (d.id = ++i));

    const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .on('click', (event, d) => {
            // Toggle children on click
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
            update(d);
        })
        .on('mouseover', (event, d) => {
            d3.select("#tooltip")
                .style("opacity", 1)
                .html(`<strong>${d.data.name}</strong><br>Sales: $${d.data.value || 0}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
        })
        .on('mouseout', () => {
            d3.select("#tooltip").style("opacity", 0);
        });

    nodeEnter.append('circle')
        .attr('class', 'node')
        .attr('r', 1e-6)
        .style("fill", d => {
            let category = d.depth === 0 ? "Default" : (d.depth === 1 ? d.data.name : d.ancestors().reverse()[1].data.name);
            let baseColor = categoryColors[category] || categoryColors["Default"];
            return d._children ? "#fff" : baseColor;
        })
        .style("stroke", d => {
            let category = d.depth === 0 ? "Default" : (d.depth === 1 ? d.data.name : d.ancestors().reverse()[1].data.name);
            return categoryColors[category] || categoryColors["Default"];
        });

    nodeEnter.append('text')
        .attr("dy", ".35em")
        .attr("x", d => d.children || d._children ? -13 : 13)
        .attr("text-anchor", d => d.children || d._children ? "end" : "start")
        .text(d => d.data.name);

    const nodeUpdate = nodeEnter.merge(node);

    nodeUpdate.transition().duration(750)
        .attr("transform", d => `translate(${d.y},${d.x})`);

    nodeUpdate.select('circle')
        .attr('r', 10)
        .style("fill", d => {
            // If it has hidden children, make it a lighter version of the category color
            // If it's a leaf, make it the solid category color
            let category = d.depth === 0 ? "Default" : (d.depth === 1 ? d.data.name : d.ancestors().reverse()[1].data.name);
            let baseColor = categoryColors[category] || categoryColors["Default"];
            return d._children ? "#fff" : baseColor; 
        })
        .style("stroke", d => {
            let category = d.depth === 0 ? "Default" : (d.depth === 1 ? d.data.name : d.ancestors().reverse()[1].data.name);
            return categoryColors[category] || categoryColors["Default"];
        })
        .attr('cursor', 'pointer');

    const nodeExit = node.exit().transition().duration(750)
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .remove();

    // --- LINKS (The Connecting Lines) ---
    const link = g.selectAll('path.link')
        .data(links, d => d.target.id);

    const linkEnter = link.enter().insert('path', "g")
        .attr("class", "link")
        .attr('d', d => {
            const o = {x: source.x0, y: source.y0};
            return diagonal(o, o);
        });

    link.merge(linkEnter).transition().duration(750)
        .attr('d', d => diagonal(d.source, d.target));

    link.exit().transition().duration(750)
        .attr('d', d => {
            const o = {x: source.x, y: source.y};
            return diagonal(o, o);
        })
        .remove();

    nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
    });

    function diagonal(s, d) {
        return `M ${s.y} ${s.x}
            C ${(s.y + d.y) / 2} ${s.x},
              ${(s.y + d.y) / 2} ${d.x},
              ${d.y} ${d.x}`;
    }
}

function searchNode() {
    const searchTerm = document.getElementById("search-input").value.toLowerCase();
    
    // Reset all circles to original style
    d3.selectAll("circle").classed("found", false);

    if (searchTerm.length === 0) return;

    // Find the node
    const foundNodes = d3.selectAll("g.node").filter(d => {
        return d.data.name.toLowerCase().includes(searchTerm);
    });

    // Highlight the found nodes
    foundNodes.select("circle").classed("found", true);
}

function loadNewData() {
    // In a real app, this would fetch from a server. 
    // Here, we'll just slightly change a value to show it works.
    d3.json("hierarchy_data.json").then(newData => {
        // Randomly change a value for demonstration
        if(newData.children) newData.children[0].value = Math.floor(Math.random() * 100);
        
        // Re-initialize and update
        root = d3.hierarchy(newData, d => d.children);
        update(root);
        console.log("Data updated dynamically!");
    });
}