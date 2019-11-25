CREATE TABLE IF NOT EXISTS recipes (
    id serial PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR NOT NULL,
    
    weight REAL NOT NULL,
    weight_full REAL GENERATED ALWAYS AS ((weight/100.0)*calories) STORED, 

    calories REAL NOT NULL,
    proteins REAL NOT NULL,
    carbohydrates REAL NOT NULL,
    fat REAL NOT NULL,
    
    image_src VARCHAR,
    products jsonb[]
);