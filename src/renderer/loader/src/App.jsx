import { useEffect, useReducer } from 'react';
import Loader from './loader/Loader';

const initialValue = {
  status: {
    status: 'Checking for updates...',
    type: 'check',
    progress: 0
  }
};

const reducer = function (state, action) {
  switch (action.type) {
    case 'setStatus': {
      return { ...state, status: action.payload };
    }
    default:
      return state;
  }
};

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialValue);

  useEffect(
    function () {
      document.title =
        typeof state.status === 'string' ? state.status : state.status?.status || 'Restaurant POS';
      document.body.classList.remove('dark');
    },
    [state.status]
  );

  return <Loader {...state} dispatch={dispatch} />;
}
