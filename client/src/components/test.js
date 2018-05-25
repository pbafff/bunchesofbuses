import React, { Component } from 'react';

class test extends Component {
    constructor() {
        super();
        this.state = 'red';
    }


    render() {
        return(<div onclick={x => {this.state = "blue"}}> test test {this.state} </div>)
    }
    
}

export default test;
