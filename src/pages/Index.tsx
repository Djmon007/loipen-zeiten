import { Navigate } from 'react-router-dom';

// Index redirects to zeiterfassung
const Index = () => {
  return <Navigate to="/zeiterfassung" replace />;
};

export default Index;
