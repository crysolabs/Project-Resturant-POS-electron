import { useEffect, useReducer } from 'react';
import Loader from './loader/Loader';
const initialValue = {
  status: 'Checking For Updates...',
  theme: 'light',
  themeType: localStorage.getItem('theme') || 'System'
};
const reducer = function (state, action) {
  switch (action.type) {
    case 'setStatus': {
      return { ...state, status: action.payload };
    }
    case 'setTheme': {
      return { ...state, theme: action.payload };
    }
    case 'setThemeType': {
      return { ...state, themeType: action.payload };
    }
    default:
      return new Error('method not found');
  }
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialValue);
  const { theme, themeType } = state;
  useEffect(
    function () {
      if (!window.matchMedia) return;
      const system = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = function () {
        console.log(themeType);
        switch (themeType) {
          case 'System': {
            localStorage.setItem('theme', 'System');
            dispatch({
              type: 'setTheme',
              payload: system.matches ? 'dark' : 'light'
            });
            return;
          }
          case 'Light': {
            localStorage.setItem('theme', 'Light');
            dispatch({ type: 'setTheme', payload: 'light' });
            return;
          }
          case 'Dark': {
            localStorage.setItem('theme', 'Dark');
            dispatch({ type: 'setTheme', payload: 'dark' });
            return;
          }
        }
      };
      handleChange();
      system.addEventListener('change', handleChange);
      return function () {
        system.removeEventListener('change', handleChange);
      };
    },
    [themeType]
  );
  useEffect(
    function () {
      document.body.classList = theme;
    },
    [theme]
  );
  return (
    <>
      <Loader {...state} dispatch={dispatch} />
    </>
  );
}
