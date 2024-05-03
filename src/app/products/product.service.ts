import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import { BehaviorSubject, catchError, combineLatest, combineLatestWith, map, Observable, tap, throwError } from 'rxjs';

import { Product } from './product';
import { ProductCategoryService } from "../product-categories/product-category.service";

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsUrl = 'api/products';
  private suppliersUrl = 'api/suppliers';

  private http = inject(HttpClient);
  private productCategoryService = inject(ProductCategoryService);

  products$$ = this.http.get<Product[]>(this.productsUrl)
    .pipe(
      // map(item => item.price * 1.5),
      // map(products => products.map(product => ({
      //   ...product,  // copies the input values from the input type
      //   price: product.price ? product.price * 1.5 : 0,  // add properties as needed
      //   searchKey: [product.productName],
      //   } as Product))),
      tap(data => console.log('Products: ', JSON.stringify(data))),
      catchError(this.handleError)
    );

  productsWithCategory$ = combineLatest([
    this.products$$,
    this.productCategoryService.productCategories$
  ]).pipe(
    map(([products, categories]) => //this is destructuring the object
    products.map(product => ({
      ...product,
      price: product.price? product.price * 1.5 : 0, // doing the transforming
      category: categories.find(c => product.categoryId === c.id)?.name,
      searchKey: [product.productName]
    }) as Product))
  );

  private productSelectedSubject = new BehaviorSubject(0);
  productSelectedAction$ = this.productSelectedSubject.asObservable();

  selectedProduct$ = combineLatest([
    this.productsWithCategory$,
    this.productSelectedAction$
  ])
    .pipe(
      map(([products, selectedProductId]) =>
      products.find(product => product.id === selectedProductId)
      ),
      tap(product => console.log('selectedProduct', product))
    );

  constructor() { }

  selectedProductChanged(selectedProductId: number) {
    this.productSelectedSubject.next(selectedProductId);
  }

  private fakeProduct(): Product {
    return {
      id: 42,
      productName: 'Another One',
      productCode: 'TBX-0042',
      description: 'Our new product',
      price: 8.9,
      categoryId: 3,
      // category: 'Toolbox',
      quantityInStock: 30
    };
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    // in a real world app, we may send the server to some remote logging infrastructure
    // instead of just logging it to the console
    let errorMessage: string;
    if (err.error instanceof ErrorEvent) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = `An error occurred: ${err.error.message}`;
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      errorMessage = `Backend returned code ${err.status}: ${err.message}`;
    }
    console.error(err);
    return throwError(() => errorMessage);
  }

}
