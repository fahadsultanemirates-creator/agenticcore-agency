import { Route, Routes } from "react-router-dom";
import { Landing } from "./pages/Landing";

// The React app owns "/" and nothing else yet.
//
// Everything signed-in -- the dashboard, projects, admin, forge, auth --
// is still the pre-React site in public/, served by Netlify as ordinary
// files at the URLs it always had. A matching file wins over the SPA
// redirect, so those pages keep working untouched while they are
// rebuilt one at a time. A big-bang cutover would mean re-proving all of
// them at once, on a site that currently works.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
    </Routes>
  );
}
