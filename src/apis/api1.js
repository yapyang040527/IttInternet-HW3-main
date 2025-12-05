export async function getCatFact() {
  const res = await fetch("https://catfact.ninja/fact");
  return res.json();
}
