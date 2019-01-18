package org.hyperledger.fabric.example;

public class CitizenInfo {
    private String bsn;
    private String firstName;
    private String lastName;
    private String address;
    private Integer financialSupport;
    private Boolean consent;
    private Integer municipalityId;

    public CitizenInfo() {
    }

    public CitizenInfo(String bsn, String firstName, String lastName, String address, Integer financialSupport, Boolean consent, Integer municipalityId) {
        this.bsn = bsn;
        this.firstName = firstName;
        this.lastName = lastName;
        this.address = address;
        this.financialSupport = financialSupport;
        this.consent = consent;
        this.municipalityId = municipalityId;
    }

    public String getBsn() {
        return bsn;
    }

    public void setBsn(String bsn) {
        this.bsn = bsn;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public Integer getFinancialSupport() {
        return financialSupport;
    }

    public void setFinancialSupport(Integer financialSupport) {
        this.financialSupport = financialSupport;
    }

    public Boolean getConsent() {
        return consent;
    }

    public void setConsent(Boolean consent) {
        this.consent = consent;
    }

    public Integer getMunicipalityId() {
        return municipalityId;
    }

    public void setMunicipalityId(Integer municipalityId) {
        this.municipalityId = municipalityId;
    }
}