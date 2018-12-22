import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule }    from '@angular/common/http';

import { AppComponent } from './app.component';
import { FooterComponent } from './footer/footer.component';
import { LoginComponent } from './login/login.component';
import { QueryCitizenComponent } from './query-citizen/query-citizen.component';
import { NavbarComponent } from './navbar/navbar.component';

import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    FooterComponent,
    LoginComponent,
    QueryCitizenComponent,
    NavbarComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
