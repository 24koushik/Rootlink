async function run() {
  console.log("Adding Node A...");
  const resA = await fetch("http://localhost:3000/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/a", title: "Node A", rawContent: "test content a" })
  });
  console.log(await resA.json());

  console.log("Adding Node B...");
  const resB = await fetch("http://localhost:3000/api/nodes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://example.com/b", title: "Node B", rawContent: "test content b" })
  });
  console.log(await resB.json());

  // Assuming node A ID is example.com/a
  const idA = "example.com/a";
  const idB = "example.com/b";

  console.log("Linking A and B...");
  const resLink = await fetch("http://localhost:3000/api/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId: idA, targetId: idB })
  });
  const data = await resLink.json();
  console.log("Graph Edges:");
  console.log(data.edges);
}
run();
