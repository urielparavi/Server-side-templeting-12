module.exports = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
    //                 catch(err => next(err))
  };
};

// The reason of the sintax catch(next)

// function errorFunction(someFunction) {
//   const message = 'Something went wrong';
//   someFunction(message);
// }

// const next1 = (param1, param2) => {
//   console.log((param1 = '1'));
// };

// errorFunction(next1); // 1
// errorFunction((msg) => next1(msg)); // 1
