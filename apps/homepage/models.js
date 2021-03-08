const mongoose = require('mongoose');
const { Schema } = mongoose;

const nameSchema = new Schema({

});

//schema method
nameSchema.methods.functionName = function(arguments) {

}

//pre middleware
nameSchema.pre('save', function() {

});

//post midleware
nameSchema.post('save', function() {

})

//create model
mongoose.model('ModelName', nameSchema);