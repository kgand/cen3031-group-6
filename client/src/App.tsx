import {Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Home from "./pages/home";
import Login from "./pages/login";
import './styles/app.css'
import './styles/fonts.css'
import Nav from "./components/nav";

const App: React.FC = () => {
  return (
    <Router>
      <Nav/>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
};

export default App;
