import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';

import {
  BehaviorSubject,
  catchError,
  combineLatest,
  combineLatestWith, filter, forkJoin,
  map, merge,
  Observable, of, scan, shareReplay,
  Subject, switchMap,
  tap,
  throwError
} from 'rxjs';

import { Product } from './product';
import { ProductCategoryService } from "../product-categories/product-category.service";
import { SupplierService } from "../suppliers/supplier.service";
import { Supplier } from "../suppliers/supplier";

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private productsUrl = 'api/products';
  private suppliersUrl = 'api/suppliers';

  private http = inject(HttpClient);
  private productCategoryService = inject(ProductCategoryService);
  private supplierService = inject(SupplierService);

  products$$ = this.http.get<Product[]>(this.productsUrl)
    .pipe(
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
      price: product.price? product.price * 1.5 : 0, // doing the transforming, add properties as needed
      category: categories.find(c => product.categoryId === c.id)?.name,
      searchKey: [product.productName]
    }) as Product)),
    shareReplay(1) // caching our data
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
      tap(product => console.log('selectedProduct', product)),
      shareReplay(1) // caching our data
    );

  // selectedProductSuppliers$ = combineLatest([  // the "get it all" approach
  //   this.selectedProduct$,
  //   this.supplierService.suppliers$
  // ]).pipe(
  //   map(([selectedProduct, suppliers]) =>  // array destructuring to assign a variable to each emission
  //   suppliers.filter(supplier => selectedProduct?.supplierIds?.includes(supplier.id)) // filter to only the suppliers in the products array of supplier ids
  //   )
  // );

  selectedProductSuppliers$ = this.selectedProduct$  // ths "just in time" approach
    .pipe(
      filter(product => Boolean(product)),
      switchMap(selectedProduct => {
        if (selectedProduct?.supplierIds) {
          return forkJoin(selectedProduct.supplierIds.map(supplierId =>
          this.http.get<Supplier>(`${this.suppliersUrl}/${supplierId}`)))
        } else {
          return of([]);
        }
      }),
      tap(suppliers => console.log('product suppliers', JSON.stringify(suppliers)))
    )

  private productAddedSubject = new Subject<Product>();
  productAddedAction$ = this.productAddedSubject.asObservable();

  productsToAdd$ = merge(
    this.productsWithCategory$,
    this.productAddedAction$
  ).pipe(
      scan((acc, value) =>
        (value instanceof Array) ? [...value] : [...acc, value], [] as Product[])
    )

  constructor() { }

  addProduct(newProduct?: Product) {
    newProduct = newProduct || this.fakeProduct();
    this.productAddedSubject.next(newProduct)
  }

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
      category: 'Toolbox',
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
