import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import test from './components/test';

// class App extends Component {
//   render() {
//     return (
//       <div className="App">
//         <header className="App-header">
//           <img src={logo} className="App-logo" alt="logo" />
//           <h1 className="App-title">Welcome to React</h1>
//         </header>
//         <p className="App-intro">
//           To get started, edit <code>src/App.js</code> and save to reload.
//           hello world test
//         </p>
//       </div>
//     )
//   }
// }
class App extends Component {
  state = {
    response: []
  };

  componentDidMount() {
    this.callApi()
      .then(res => this.setState({ response: res }))
      .catch(err => console.log(err));
  }

  callApi = async () => {
    const response = await fetch('/index');
    const body = await response.json();

    if (response.status !== 200) throw Error(body.message);

    return body;
  };

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <test />
        <test />
        <test />
        {/* <div className="App-intro">{this.state.response}</div> */}
        {this.state.response.map(user =>
          <div key={user._id}>{user.begin}</div>
        )}
      </div>
    )
  }
}

export default App;
