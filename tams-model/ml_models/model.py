import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.multioutput import MultiOutputRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
import joblib

df = pd.read_excel("Taqathon_data_01072025.xlsx", sheet_name="Oracle")
df = df.drop(columns=["Date de détéction de l'anomalie", "Section propriétaire"])
df = df.fillna("unknown")

label_encoders = {}
for col in ["Num_equipement", "Systeme"]:
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])
    label_encoders[col] = le

vectorizer = CountVectorizer(max_features=100)
text_features = vectorizer.fit_transform(df["Description"]).toarray()

X = np.concatenate([
    df[["Num_equipement", "Systeme"]].values,
    text_features
], axis=1)

y = df[["Fiabilité Intégrité", "Disponibilté", "Process Safety", "Criticité"]]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=1337)

model = MultiOutputRegressor(RandomForestRegressor())
model.fit(X_train, y_train)
y_pred = model.predict(X_test)
mse_scores = mean_squared_error(y_test, y_pred, multioutput='raw_values')

for i, col in enumerate(y.columns):
    print(f"{col} MSE: {mse_scores[i]:.4f}")

joblib.dump(model, "multi_output_model.pkl")
