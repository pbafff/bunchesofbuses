import React, { Component } from 'react';

class Test extends Component {
    constructor(props) {
        super(props);
        this.state = {
            color: "red"
        }
    }

   flipColor() {
       if (this.state.color === 'red') {
           return this.setState({color: "blue"})
       }
       return this.setState({color: "red"})
   }


    render() {
        return(<div onClick = {() => this.flipColor()}> test test {this.state.color} </div>)
    }
    
}

export default Test;
