export async function getJoke() {
  const res = await fetch("https://official-joke-api.appspot.com/random_joke");
  return res.json();
}
