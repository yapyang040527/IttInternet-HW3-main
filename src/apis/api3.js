export async function getAdvice() {
  const res = await fetch("https://api.adviceslip.com/advice");
  return res.json();
}
