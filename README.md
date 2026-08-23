# Model

TypeScript equivalent of the [Laravel Eloquent](https://laravel.com/docs/12.x/eloquent) data modeling layer: attributes, casts, accessors and mutators, mass assignment, dirty tracking and serialization, without the database.

## Installation & setup

### NPM

You can install the package via npm:

```bash
npm install @bjnstnkvc/model
```

and then import it into your project

```ts
import { Model, Attribute } from '@bjnstnkvc/model';
```

## Usage

### Defining a Model

To get started, define an interface describing your attributes, extend the `Model` class and merge the interface into it. The merge is what makes direct property access fully typed:

```ts
import { Model, Attribute, type Attributes, type AttributeBag, type Casts } from '@bjnstnkvc/model';

interface UserAttributes {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    age: number;
    created_at: Date;
    fullName: string;
}

class User extends Model<UserAttributes> {
    override casts(): Casts<UserAttributes> {
        return {
            id        : 'int',
            age       : 'int',
            created_at: 'datetime',
        };
    }

    override mutators(): Attributes<UserAttributes> {
        return {
            fullName: Attribute.get<string>((value: unknown, attributes: AttributeBag<UserAttributes>): string => `${attributes['first_name']} ${attributes['last_name']}`),
            email   : Attribute.set<string>((value: string): unknown => value.toLowerCase()),
        };
    }

    override fillable(): (keyof UserAttributes & string)[] {
        return ['first_name', 'last_name', 'email', 'age'];
    }

    override hidden(): (keyof UserAttributes & string)[] {
        return ['email'];
    }

    override defaults(): Partial<UserAttributes> {
        return { age: 18 };
    }
}

interface User extends UserAttributes {
}
```

Once defined, attributes may be accessed and assigned as regular properties. Casts, accessors and mutators are applied transparently:

```ts
const user: User = User.hydrate({ id: '7', first_name: 'John', last_name: 'Doe', created_at: '2026-08-23T10:00:00.000Z' });

user.id;         // 7
user.fullName;   // 'John Doe'
user.created_at; // Date instance

user.email = 'JOHN@EXAMPLE.COM';

user.raw('email'); // 'john@example.com'
```

### Configuring a Model

Configuration is declared through methods rather than properties, since class field initializers run after the parent constructor. Each method may be overridden per model.

#### casts()

The `casts` method returns a map of attributes that should be cast when read. The following cast types are available: `int`, `integer`, `float`, `double`, `number`, `string`, `bool`, `boolean`, `json`, `array`, `object`, `date`, `datetime`, `timestamp` and `decimal:<places>`:

```ts
override casts(): Casts<UserAttributes> {
    return {
        age       : 'int',
        options   : 'json',
        salary    : 'decimal:2',
        created_at: 'datetime',
    };
}
```

An unknown cast type throws a `TypeError` on both read and write. Values of `null` and `undefined` pass through every cast untouched.

#### mutators()

The `mutators` method returns the accessor and mutator definitions for the model. See [Accessors & Mutators](#accessors--mutators).

#### fillable()

The `fillable` method returns the attribute keys that are mass assignable. When the list is empty and no keys are guarded, every attribute is fillable:

```ts
override fillable(): (keyof UserAttributes & string)[] {
    return ['first_name', 'last_name', 'email'];
}
```

#### guarded()

The `guarded` method returns the attribute keys that are not mass assignable. When both lists are declared, the fillable list wins:

```ts
override guarded(): (keyof UserAttributes & string)[] {
    return ['id'];
}
```

#### hidden()

The `hidden` method returns the attribute keys excluded from serialization:

```ts
override hidden(): (keyof UserAttributes & string)[] {
    return ['email'];
}
```

#### visible()

The `visible` method returns the serialization whitelist. When the list is not empty, only these keys are serialized:

```ts
override visible(): (keyof UserAttributes & string)[] {
    return ['first_name', 'last_name'];
}
```

#### appends()

The `appends` method returns the virtual keys appended to serialization:

```ts
override appends(): (keyof UserAttributes & string)[] {
    return ['fullName'];
}
```

#### defaults()

The `defaults` method returns the initial attribute values. Defaults are applied before construction attributes and do not mark the model as dirty:

```ts
override defaults(): Partial<UserAttributes> {
    return { age: 18 };
}
```

### Accessors & Mutators

Accessors and mutators are declared through the `Attribute` class, mirroring `Illuminate\Database\Eloquent\Casts\Attribute`.

#### Attribute.get()

The `Attribute.get` method defines an accessor, a transformation applied when the attribute is read. The callback receives the raw value and the raw attribute bag:

```ts
fullName: Attribute.get<string>((value: unknown, attributes: AttributeBag<UserAttributes>): string => `${attributes['first_name']} ${attributes['last_name']}`)
```

An accessor wins over a cast declared for the same key and receives the raw, uncast value.

#### Attribute.set()

The `Attribute.set` method defines a mutator, a transformation applied when the attribute is written. The returned value is stored as the raw attribute:

```ts
email: Attribute.set<string>((value: string): unknown => value.toLowerCase())
```

A mutator returning a plain object writes multiple raw attributes at once. To store a plain object as a single value, wrap it under its own key:

```ts
fullName: Attribute.set<string>((value: string): unknown => {
    const [first, last]: string[] = value.split(' ');

    return { first_name: first, last_name: last };
})
```

#### Attribute.make()

The `Attribute.make` method defines an accessor and a mutator in a single definition:

```ts
fullName: Attribute.make<string>({
    get: (value: unknown, attributes: AttributeBag<UserAttributes>): string => `${attributes['first_name']} ${attributes['last_name']}`,
    set: (value: string): unknown => {
        const [first, last]: string[] = value.split(' ');

        return { first_name: first, last_name: last };
    },
})
```

### Custom Casts

A custom cast is any object implementing the `Cast` interface, mirroring Eloquent's `CastsAttributes`. Pass an instance in the cast map:

```ts
import { Model, type Cast, type AttributeBag, type Casts } from '@bjnstnkvc/model';

class Settings implements Cast<{ theme: string }> {
    get(value: unknown, key: string, attributes: AttributeBag): { theme: string } {
        return Object.freeze({ ...(value as { theme: string }) });
    }

    set(value: { theme: string }, key: string, attributes: AttributeBag): unknown {
        return value;
    }
}

class User extends Model<UserAttributes> {
    override casts(): Casts<UserAttributes> {
        return { settings: new Settings() };
    }
}
```

### Retrieving Attributes

#### get()

The `get` method returns an attribute value with accessors and casts applied. Keys outside the declared interface are allowed and returned as `unknown`:

```ts
user.get('age');     // 18
user.get('address'); // unknown key, still readable
```

#### raw()

The `raw` method returns a copy of the raw stored attributes, or a single raw value when a key is given:

```ts
user.raw();              // { first_name: 'John', ... }
user.raw('created_at');  // '2026-08-23T10:00:00.000Z'
```

#### has()

The `has` method determines whether an attribute is present, either as a raw value or as a readable virtual:

```ts
user.has('first_name'); // true
user.has('fullName');   // true
user.has('missing');    // false
```

#### only()

The `only` method returns a cast applied subset of the attributes:

```ts
user.only('first_name', 'age'); // { first_name: 'John', age: 18 }
```

#### except()

The `except` method returns all cast applied attributes except the given keys:

```ts
user.except('email');
```

### Setting Attributes

#### set()

The `set` method assigns an attribute value, applying mutators and cast normalization. Declared keys are type checked, while any other string key is accepted:

```ts
user.set('age', '35');           // stored and read back as 35
user.set('address', 'Main St');  // key outside the interface
```

#### fill()

The `fill` method mass assigns attributes while honoring the fillable and guarded rules. Non fillable keys are silently discarded unless strict mode is enabled:

```ts
user.fill({ first_name: 'Jane', id: 1 }); // id is discarded
```

#### forceFill()

The `forceFill` method mass assigns attributes while bypassing all guarding:

```ts
user.forceFill({ id: 1 });
```

#### forget()

The `forget` method removes an attribute from raw storage:

```ts
user.forget('address');
```

### Mass Assignment

By default every attribute is fillable. Once `fillable` or `guarded` lists are declared, offending keys are silently discarded during `fill`, matching Eloquent. Enabling strict mode throws a `MassAssignmentError` instead:

```ts
Model.strict = true;

new User({ id: 1 }); // throws MassAssignmentError
```

#### Model.hydrate()

The static `hydrate` method creates a model from trusted raw data, bypassing guards and mutators. A hydrated model is synced clean:

```ts
const user: User = User.hydrate({ id: 7, first_name: 'John' });

user.dirty(); // false
```

Attributes created through the constructor, on the other hand, are marked as dirty:

```ts
const user: User = new User({ first_name: 'John' });

user.dirty(); // true
```

### Dirty Tracking

#### dirty()

The `dirty` method determines whether any attribute, or any of the given attributes, changed since the last sync:

```ts
user.set('first_name', 'Jane');

user.dirty();             // true
user.dirty('first_name'); // true
user.dirty('age');        // false
```

#### changes()

The `changes` method returns the raw attributes that changed since the last sync:

```ts
user.changes(); // { first_name: 'Jane' }
```

#### original()

The `original` method returns the last synced attributes with casts applied, or a single one of them:

```ts
user.original('first_name'); // 'John'
```

#### sync()

The `sync` method snapshots the current raw attributes as the original state:

```ts
user.sync();

user.dirty(); // false
```

#### discard()

The `discard` method reverts the raw attributes to the last synced original state:

```ts
user.set('first_name', 'Jane');
user.discard();

user.first_name; // 'John'
```

### Serialization

#### toJSON()

The `toJSON` method serializes the model to a plain object, applying casts, accessors, appends and visibility rules. Since `toJSON` is the native serialization hook, `JSON.stringify` works out of the box:

```ts
JSON.stringify(user); // '{"first_name":"John","fullName":"John Doe"}'
```

#### hide()

The `hide` method hides the given keys from serialization at runtime:

```ts
user.hide('first_name');
```

#### show()

The `show` method reveals hidden keys at runtime:

```ts
user.show('email');
```

#### append()

The `append` method appends the given virtual keys to serialization at runtime:

```ts
user.append('fullName');
```

## Notes

Class members shadow same named attributes when accessed as properties. An attribute literally named `fill` is still stored and remains reachable through `user.get('fill')` and `user.set('fill', value)`.

Spreading a model or calling `Object.keys` on it operates on the instance, not on the attributes. Use `raw()` for a plain copy of the raw attributes or `toJSON()` for the serialized form.
