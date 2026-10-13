import { createRoot } from 'react-dom/client'
import './index.css'
import 'react-toastify/dist/ReactToastify.css'
import App from './App.jsx'
import {BrowserRouter} from 'react-router-dom'
import { Provider } from 'react-redux'
import { store } from './redux/store.js'
import { ToastContainer } from 'react-toastify'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Provider store={store}>
      <App />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </Provider>
  </BrowserRouter>
)
