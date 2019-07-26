const array1 = [1, 2, 3, 4];
const reducer = (accumulator, currentValue, i, arr) => {
 if(arr[i+1]) return accumulator + (arr[i+1] - currentValue)
 else return accumulator;
};


console.log(array1.reduce(reducer));