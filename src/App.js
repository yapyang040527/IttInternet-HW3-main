import './App.css';
import { useEffect, useState } from "react";
import { getCatFact } from "./apis/api1.js";
import { getJoke } from "./apis/api2.js";
import { getAdvice } from "./apis/api3.js";

function App() {
  const [catFact, setCatFact] = useState("");
  const [joke, setJoke] = useState("");
  const [advice, setAdvice] = useState("");

  useEffect(() => {
    getCatFact()
      .then((d) => {
        console.log("CatFact:", d);
        setCatFact(d.fact);
      })
      .catch((err) => console.error("Cat Fact Error:", err));

    getJoke()
      .then((d) => {
        console.log("Joke:", d);
        setJoke(`${d.setup} — ${d.punchline}`);
      })
      .catch((err) => console.error("Joke Error:", err));

    getAdvice()
      .then((d) => {
        console.log("Advice:", d);
        setAdvice(d.slip.advice);
      })
      .catch((err) => console.error("Advice Error:", err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>My Website</h1>

      <h2>Cat Fact</h2>
      <p>{catFact}</p>

      <h2>Joke</h2>
      <p>{joke}</p>

      <h2>Advice</h2>
      <p>{advice}</p>
    </div>
  );
}

export default App;
