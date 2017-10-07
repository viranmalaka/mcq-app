import {NextFunction, Request, Response, Router} from "express";
import {BaseController} from "../controllers/base-controller";
import {IUserModel} from "../models/User";
/**
 * Created by malaka on 7/21/17.
 */

// Some customizable interfaces
export interface Ability{
	c?: boolean,
	r?: Array<string>,
	u?: Array<string>,
	d?: boolean,
	count?: boolean,
}

export interface RouterConfig {
	modelName: string,
	ownerShip?: string,
	validationRules: any,
	ownerActions?: Ability,
	otherActions?: {S?: Ability, T?: Ability, D?: Ability},
	guestActions?: Ability,
}

export class BaseRouter {

  constructor() {

  }

  public create(router: Router, type, config?: RouterConfig) {
    router.get('/', this.find(type, config));
    // router.post('/find', this.complexFind(type, option));
    router.post('/', this.add(type, config));
    router.put('/:id', this.edit(type, config));
    router.put('/:id/edit', this.update(type, config));
    router.delete('/:id', this.remove(type, config));
    router.get('/count', this.count(type, config));

    return router;
  }

  private find(type, options: RouterConfig) {
    return function (req: Request, res: Response, next: NextFunction) {
    	// user
	    let user: IUserModel = req.user,
		    accType = user ? user.accType : undefined;

      // collect request data
      let sort = '', select = '';
      if(req.query['_sort']){
        sort = req.query['_sort'].split(',').join(' ');
        delete req.query['_sort'];
      }
      if(req.query['_select']){
        select = req.query['_select'].split(',');
        delete req.query['_select'];
      }

      // common function
	    let resultGenFunction =  (err, result) => {
			    if (err) return next(err);
			    res.jsonp({status: 4, result: result});
	    };

      if(user){
      	// authenticated User
	      if(accType == 'A'){  // admin
		      if(req.query['_id']){
			      new BaseController(type).findById(req.query['_id'], select, resultGenFunction);
		      }else{
			      new BaseController(type).find(req.query, sort, select, resultGenFunction)
		      }
	      } else {             // owner + others
		      if (options.ownerShip) {
			      if (req.query['_id']) {
				      new BaseController(type).findById(req.query['_id'], this.commonSelect(select, options.ownerActions.r), (err, results) => {
					      if (err) return next(err);
					      if (results[options.ownerShip].equals(user._id)) {   // check the ownership
						      res.jsonp({status: 4, result: results});
					      } else {    // others
						      if (options.otherActions[accType].r) {
						      	// others can read
							      let responseObj = {};
							      this.commonSelect(select, options.otherActions[accType].r).forEach((x) => {
								      responseObj[x] = results[x];
							      });
							      res.jsonp({status: 4, result: responseObj});
						      } else {
							      // error
							      return next({status : 22, message : 'No privilege to read : ' + user.username, from:'base-router: find'});
						      }
					      }
				      });
			      } else {
				      // check the query object has ownership key and validate is with current user.
				      // then return owner actions.
				      // if the query object dosen't have ownership key we provide only otherActions.

				      // ownership validation : (req.query[options.ownerShip] == user._id)
				      if (req.query[options.ownerShip]) { // go to ownership validation
					      if (req.query[options.ownerShip].equals(user._id)) {
						      // owner
						      new BaseController(type).find(req.query, sort, this.commonSelect(select, options.ownerActions.r), resultGenFunction)
					      } else {
						      // others
						      if (options.otherActions[accType].r) {
							      new BaseController(type).find(req.query, sort, this.commonSelect(select, options.otherActions[accType].r), resultGenFunction)
						      }else{
						      	// error
							      return next({status : 22, message : 'No privilege to read : ' + user.username, from:'base-router: find'});
						      }
					      }
				      } else {
				      	// no ownership validation, give others actions.
					      if(options.otherActions[accType].r){
					      	// others can read
						      new BaseController(type).find(req.query, sort, this.commonSelect(select, options.otherActions[accType].r), resultGenFunction)
					      }else{
					      	// error
						      return next({status : 22, message : 'No privilege to read : ' + user.username, from:'base-router: find'});
					      }
				      }
			      }
		      } else {
			      // others actions
			      if (options.otherActions[accType].r) {
			      	// others can read
				      if (req.query['_id']) {
					      new BaseController(type).findById(req.query['_id'], this.commonSelect(select, options.otherActions[accType].r), resultGenFunction);
				      } else {
					      new BaseController(type).find(req.query, sort, this.commonSelect(select, options.otherActions[accType].r), resultGenFunction)
				      }
			      } else {
			      	// error
							return next({status : 22, message : 'No privilege to read : ' + user.username, from:'base-router: find'});
			      }
		      }
	      }
      }else {
	      // a guest
	      if (options.guestActions.r) {
		      if (req.query['_id']) {
			      new BaseController(type).findById(req.query['_id'], this.commonSelect(select, options.guestActions.r), resultGenFunction);
		      } else {
			      new BaseController(type).find(req.query, sort, this.commonSelect(select, options.guestActions.r), resultGenFunction)
		      }
	      } else {
		      //error
		      return next({status : 21, message : 'No privilege to read : guest', from:'base-router: find'});
	      }
      }
    }.bind(this);
  }

  private complexFind(type){
    return (req: Request, res: Response, next: NextFunction) => {
      // body can contain query, projection, sort.
      new BaseController(type).find(req.body['query'], req.body['select'], req.body['sort'], (err, results) => {
      	if(err) return next(err);
      	res.jsonp({status: 200, results : results});
      });
    }
  }

  private add(type, options: RouterConfig){
    return function (req: Request, res: Response, next: NextFunction) {
	    let addFunction = (readFields: Array<string>) => {
		    new BaseController(type).add(req.body, options.validationRules, (err, result) => {
			    if (err) {
			    	if(err.errors){
					    if(err.errors[Object.keys(err.errors)[0]]['$isValidatorError']){
						    err.status = 16;
					    }
				    }
			    	return next(err);
			    }
			    res.jsonp({status: 2, result: this.filterResponse(result, readFields)});
		    });
	    };

    	if (req.user) {
	    	if(req.user.accType == 'A'){
			    return addFunction([]);
		    }else{
	    		if(options.otherActions[req.user.accType].c){
						return addFunction(options.otherActions[req.user.accType].r);
			    }else{
				    return next({status : 22, message : 'No privilege to create : ' + req.user.username, from:'base-router: add'});
			    }
		    }
	    } else {
	    	if(options.guestActions.c){
			    return addFunction(options.guestActions.r);
		    }else{
			    return next({status : 21, message : 'No privilege to create: guest', from:'base-router: add'});
		    }
	    }
    }
  }

  // update whole object (owner or admin)
  private update(type, options: RouterConfig){
  	let controller = new BaseController(type);
    return (req : Request, res : Response, next : NextFunction) => {
      let id = req.params['id'];
      if(id){
        delete req.body['_id'];
        controller.findById(id,'', (err, object) => {
        	if(err) return next(err);
	        if (object) {
		        if (object[options.ownerShip].equals(req.user._id) || req.user.accType == 'A') {
			        controller.editById(id, req.body, options.validationRules, (err, result) => {
				        if (err) return next(err);
				        return res.jsonp({status: 3, result: this.filterResponse(result, options.ownerActions.r)});
			        });
		        } else {
		        	return next({status: 22, message: 'No privilege to update : ' + req.user.username, from:'base-router: update'})
		        }
	        }else{
	        	return next({status: 14, message: 'No such object', from:'base-router: update'})
	        }
        });
      }
    }
  }

  private edit(type, options: RouterConfig){
	  return (req: Request, res: Response, next: NextFunction) => {
	  	let editFunction = (opt, readFields) => {
			  new BaseController(type).edit(req.params['id'], req.body, options.validationRules, opt, (err, result) => {
				  if (err) return next(err);
				  return res.jsonp({status: 3, result: this.filterResponse(result, readFields)});
			  });
		  };
		  if (req.user) {
			  if (req.user.accType == 'A') {
				  editFunction(options.ownerActions ? options.ownerActions.u: [], options.ownerActions.r);
			  } else {
				  if (options.otherActions[req.user.accType].u) {
					  editFunction(options.otherActions[req.user.accType].u, options.otherActions[req.user.accType].r);
				  } else {
				  	return next({status: 22, message:'No privilege to edit : ' + req.user.username, from:'base-router: edit'})
				  }
			  }
		  } else {
			  if (options.guestActions) {
				  editFunction(options.guestActions.u, options.guestActions.r);
			  } else {
				  return next({status: 21, message:'No privilege to edit : guest', from:'base-router: edit'})
			  }
		  }
	  };
  }

  private remove(type, options: RouterConfig){
    return (req: Request, res: Response, next: NextFunction) => {
      let id = req.params['id'];
      if(req.user) {
	      if (req.user.accType == 'A') {
		      new BaseController(type).remove(id, (err, doc) => {
			      if (err) return next(err);
			      if (!doc) {
				      return res.jsonp({status: 14})
			      }
			      res.jsonp({status: 5, result: doc});
		      })
	      } else {
		      new BaseController(type).findById(id, '', (err, doc) => {
			      if (err) return next(err);
			      if (doc) {
				      if (doc[options.ownerShip].equals(req.user._id)) {
					      if (options.ownerActions.d) {
						      new BaseController(type).remove(id, (err, doc) => {
							      if (err) return next(err);
							      if (!doc) {
								      return res.jsonp({status: 14})
							      }
							      res.jsonp({status: 5, result: doc});
						      })
					      } else {
						      return next({status: 22, message: 'No privilege to delete : ' + req.user.username, from:'base-router: remove'});
					      }
				      } else {
					      if (options.otherActions[req.user.accType].d) {
						      new BaseController(type).remove(id, (err, doc) => {
							      if (err) return next(err);
							      if (!doc) {
								      return res.jsonp({status: 14})
							      }
							      res.jsonp({status: 5, result: doc});
						      })
					      } else {
						      return next({status: 22, message: 'No privilege to delete : ' + req.user.username, from:'base-router: remove'});
					      }
				      }
			      } else {
				      return next({status: 14, message: 'No such object', from:'base-router: remove'});
			      }
		      });
	      }
      }else{
      	// guest
	      if(options.guestActions){
	      	if(options.guestActions.d){
			      new BaseController(type).remove(id, (err, doc) => {
			      	if(err) return next(err);
			      	if(!doc){
			      		return res.jsonp({status: 14});
				      }
				      res.jsonp({status:5, result: doc});
			      });
		      }else{
			      return next({status: 21, message: 'No privilege to delete : guest', from:'base-router: remove'});
		      }
	      }else{
		      return next({status: 21, message: 'No privilege to delete : guest', from:'base-router: remove'});
	      }
      }
    }
  }

  private count(type, options: RouterConfig){
  	return (req: Request, res: Response, next: NextFunction) => {
		  if(req.user ? req.user.accType == 'A' ||
				  options.otherActions[req.user.accType].count :
				  options.guestActions.count){
			  new BaseController(type).count(req.query, (err, count) => {
				  if(err) return next(err);
				  res.jsonp({status : 4, count: count});
			  })
		  }else{
			  return next({status : (req.user ? 22 : 21), message : 'No privilege to get count', from:'base-router: count'});
		  }
	  }
  }

	public commonSelect(select: Array<string>, canSelect: Array<string>){
		let x;
		if(select.length !== 0){
			let isNeg = false;
			select.forEach(val => {
				if(val.substring(0,1) ===  '-') {
					if(val !== '-_id') isNeg = true;
				}
			});
			if(isNeg){
				x = canSelect.filter(val => {
					return select.indexOf('-' + val) < 0;
				});
			}else{
				x = select.filter(val => {
					return canSelect.indexOf(val) > -1;
				})
			}
			if(select.indexOf('-_id') > -1){
				x.unshift('-_id');
			}
		}else{
			x = canSelect;
		}
		return x;
	}

	private filterResponse(data: any, allowedFields: Array<string>): any{
		if(allowedFields === undefined || allowedFields.length === 0){
			return data;
		} else {
			const result = {};
			allowedFields.forEach(field => {
				result[field] = data[field];
			});
			if(data['_id']){
				result['_id'] = data['_id'];
			}
			return result;
		}
	}
}