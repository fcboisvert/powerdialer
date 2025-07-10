import PowerDialer from './components/PowerDialer';
import CallWebhookHandler from './components/CallWebhookHandler';

function App() {
  return (
    <div className="App">
      {/* Hidden component that handles webhooks */}
      <CallWebhookHandler />
      
      {/* Your main PowerDialer UI */}
      <PowerDialer />
    </div>
  );
}

export default App;