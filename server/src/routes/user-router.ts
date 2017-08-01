import {NextFunction, Request, Response, Router} from "express";
import * as passport from "passport";
import * as LocalStrategy from "passport-local";
import * as jwt from "jsonwebtoken";
import {UserController} from "../controllers/user-controller";
import {DataEntry, IUserModel, Student, Teacher, User} from "../models/User";
import {Actions, BaseRouter} from "./base-router";

/**
 * Created by MalakaD on 7/26/2017.
 */

export class UserRouter {

	private baseRouter: BaseRouter;

	constructor(){
		this.baseRouter = new BaseRouter();
	}

	public create(): Router {
  	let router: Router = Router();

    router.post('/signup', UserRouter.signup);
    router.post('/login', UserRouter.login);

    router.use('/student', new StudentRouter().create(router));
    router.use('/teacher', new TeacherRouter().create(router));
    router.use('/dataentry', new DataEntryRouter().create(router));

    router.use(this.baseRouter.create(router, User));

    return router;
  }

  public static signup(req: Request, res: Response, next: NextFunction) {
    new UserController(User).createUser(req.body, (err: Error, user: IUserModel) => {
      req.login(user, (err: Error) => {              // after signup automatic login
        if (err) return next(err);
        res.json({
          user: {
            accId: user.accId,
            username: user.username,
            email: user.email,
            accType: user.accType
          },
          token: UserRouter.getToken(user._id),
          status: 200
        });
      });

    });
  }

  public static login(req: Request, res: Response, next: NextFunction) {
    passport.authenticate('local', {        // passport auth
      session: false
    }, function (err: Error, user: IUserModel, info) {
      if (err) {
        return next(err); // will generate a 500 error
      }
      if (! user) {
        return res.send({ success : false, message : 'authentication failed' });
      }
      req.login(user, (loginErr: Error) => {
        if (loginErr) {
          return next(loginErr);
        }
        return res.json({                            // send the user with the token
          user: {
            accId: req.user.accId,
            username: req.user.username,
            email: req.user.email,
            accType: req.user.accType,
            profilePicture: req.user.profilePicture
          },
          token: UserRouter.getToken(user._id),
          success: true
        });
      });
    })(req, res, next);
  }

  public static _validateToken(req: Request, res: Response, next: NextFunction) {
    if (!req.get('token')) {
      next();
    } else {
      let user = jwt.verify(req.get('token'), 'secret');
      new UserController(User).findById(user['id'],'', function (err: Error, doc: IUserModel) {
        req.user = doc;
        next();
      })
    }
  }

  public static getToken(id) {
    let x: object = {
      id: id,
    };
    return jwt.sign(x, 'secret', {
      expiresIn: '10h'
    });
  }

  public static initPassport() {
    passport.use(new LocalStrategy.Strategy((username, password, done) => {
      User.findOne({username: username}, (err, user) => {
        if (!user) {
          return done(null, false, {message: 'Unknown user'});
        }
        UserController.comparePassword(password, user.password, (err, isMatch) => {
          if (err) {
            console.log(err);
          } else {
            if (isMatch) {
              return done(null, user);
            } else {
              return done(null, false, {message: 'Invalid Password'});
            }
          }
        });
      });
    }));

    passport.serializeUser(function (user, done) {
      done(null, user);
    });

    passport.deserializeUser(function (user, done) {
      done(null, user);
    });
  }
}


class StudentRouter {
  private baseRouter: BaseRouter;

  constructor(){
    this.baseRouter = new BaseRouter();
  }

  public create(router: Router): Router{
    return this.baseRouter.create(router, Student);
  }
}

class TeacherRouter {
  private baseRouter: BaseRouter;

  constructor(){
    this.baseRouter = new BaseRouter();
  }

  public create(router: Router): Router{
    return this.baseRouter.create(router, Teacher, [Actions.Create, Actions.Remove]);
  }
}

class DataEntryRouter {
  private baseRouter: BaseRouter;

  constructor(){
    this.baseRouter = new BaseRouter();
  }

  public create(router: Router): Router{
    return this.baseRouter.create(router, DataEntry, [Actions.Create, Actions.Remove]);
  }
}
