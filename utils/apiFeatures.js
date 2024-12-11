class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    // BUILD QUERY
    // 1A) Filtering
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // 1B) Advanced filtering
    // Forex: difficulty=easy&name=The Forest Hiker
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);
    // Forex: Tour.find({ difficulty:'easy', duration: { $gte:5 } })

    this.query = this.query.find(JSON.parse(queryStr));
    // let query = Tour.find(JSON.parse(queryStr));
    return this;
  }

  sort() {
    // 2) Sorting
    if (this.queryString.sort) {
      console.log(this.queryString.sort);
      const sortBy = this.queryString.sort.split(',').join(' ');
      // Forex: -price -ratingsAverage
      this.query = this.query.sort(sortBy);
    } else {
      // query = query.sort('-createdAt');
      this.query = this.query.sort('_id');
    }

    return this;
  }

  limitFields() {
    // 3) Field limiting
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      // Forex: name,duration,difficulty,price => name duration difficulty price
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v');
    }

    return this;
  }

  paginate() {
    // Pagination
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;
    // Forex: page=3&limit=10 => 1-10, page 1, 11-20, page 2, 21-30, page 3
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
