
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Overlay from './components/Overlay';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const isOverlay = window.location.search.includes('mode=overlay');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {isOverlay ? <Overlay /> : <App />}
  </React.StrictMode>
);
